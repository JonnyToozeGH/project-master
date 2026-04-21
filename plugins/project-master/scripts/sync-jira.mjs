#!/usr/bin/env node
/**
 * Sync ProjectMaster spec sidecar YAMLs with Jira.
 *
 * Direction: git is canonical for spec content. Jira is canonical for status
 * transitions (what the team is actively working on).
 *
 * What this script does:
 *  - Walks all sidecar YAMLs under specs/
 *  - For each YAML with jira_key set: fetches the Jira issue, updates local
 *    content_hash, writes status back to sidecar if it has changed
 *  - For each YAML with jira_key null: creates a new Jira issue, writes the
 *    returned key back into the sidecar, and (new in v0.1.3) transitions the
 *    new ticket to match the sidecar's local status. This fixes the initial
 *    bulk-import case where the local spec already has completed / in-progress
 *    stories - without this step every new ticket lands in "To Do" regardless
 *    of what the sidecar says.
 *
 * Environment variables required:
 *   JIRA_HOST     - e.g. https://your-org.atlassian.net
 *   JIRA_EMAIL    - the account email
 *   JIRA_API_TOKEN - API token from https://id.atlassian.com/manage-profile/security/api-tokens
 *   JIRA_PROJECT  - the project key (no default - must be set per project)
 *
 * Optional:
 *   JIRA_STATUS_MAP - override the sidecar-to-Jira status mapping. Format:
 *     "completed=Done,in_progress=In Progress". Defaults assume the standard
 *     Jira workflow. Omit a key to skip transitioning that status.
 *
 * Usage:
 *   node scripts/sync-jira.mjs                   # dry run (reports what would change)
 *   node scripts/sync-jira.mjs --apply           # actually push changes
 *   node scripts/sync-jira.mjs --only specs/foo  # limit to a subtree
 *   node scripts/sync-jira.mjs --project /path   # override project root detection
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';

const { values: args } = parseArgs({
  options: {
    apply: { type: 'boolean', default: false },
    only: { type: 'string', default: '.' },
    verbose: { type: 'boolean', default: false },
    project: { type: 'string' },
    'skip-git-check': { type: 'boolean', default: false },
  },
});

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const JIRA_HOST = process.env.JIRA_HOST;
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;
const JIRA_PROJECT = process.env.JIRA_PROJECT;

if (!JIRA_HOST || !JIRA_EMAIL || !JIRA_API_TOKEN || !JIRA_PROJECT) {
  console.error('Missing required env vars. All four must be set:');
  console.error('  JIRA_HOST');
  console.error('  JIRA_EMAIL');
  console.error('  JIRA_API_TOKEN');
  console.error('  JIRA_PROJECT');
  process.exit(2);
}

const AUTH = Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64');

// ---------------------------------------------------------------------------
// Project root detection
// ---------------------------------------------------------------------------

function detectProjectRoot() {
  if (args.project) return path.resolve(args.project);

  let cur = process.cwd();
  const stopAt = path.parse(cur).root;

  while (cur !== stopAt) {
    const hasSpecFolder =
      fs.existsSync(path.join(cur, 'specs')) ||
      fs.existsSync(path.join(cur, 'decisions')) ||
      fs.existsSync(path.join(cur, 'research'));
    if (hasSpecFolder) return cur;
    cur = path.dirname(cur);
  }

  return process.cwd();
}

const root = detectProjectRoot();
const target = path.resolve(root, args.only === '.' ? '' : args.only);

// ---------------------------------------------------------------------------
// Git preflight
//
// The script walks local sidecar YAMLs and treats them as source of truth.
// Running against a stale working copy can create duplicate Jira tickets
// (the script cannot see jira_keys that only exist on origin) or miss
// updates others have pushed. Fail fast if the repo is dirty or behind
// origin. Override with --skip-git-check only if you know what you are
// doing.
// ---------------------------------------------------------------------------

function runGit(cmd) {
  return execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function preflightGit() {
  if (args['skip-git-check']) {
    console.warn('WARN: --skip-git-check set, bypassing git state check.');
    return;
  }

  let inRepo = false;
  try {
    runGit('git rev-parse --is-inside-work-tree');
    inRepo = true;
  } catch {
    // Not a git repo. Skip preflight - user has opted out of git-backed spec
    // management. The script will still work; the safety check just does not
    // apply.
  }
  if (!inRepo) {
    console.warn('WARN: project root is not a git repository. Skipping sync safety checks.');
    return;
  }

  // Dirty tree
  let dirty = '';
  try {
    dirty = runGit('git status --porcelain');
  } catch {
    // Fall through - unreachable except on broken git installs
  }
  if (dirty) {
    console.error('\nRefusing to sync: working tree has uncommitted changes.\n');
    console.error(dirty + '\n');
    console.error('Commit, stash, or discard local changes first. Or pass');
    console.error('--skip-git-check to bypass (not recommended - can create');
    console.error('duplicate Jira tickets if you have local jira_key updates).\n');
    process.exit(3);
  }

  // Behind origin? Best-effort - silently skip if no remote or no tracking
  try {
    const branch = runGit('git rev-parse --abbrev-ref HEAD');
    // Fetch the current branch to check if behind
    try {
      runGit(`git fetch origin ${branch} --quiet`);
    } catch {
      // No origin, no remote branch, or offline - skip this check
      return;
    }
    const behind = parseInt(runGit(`git rev-list --count HEAD..origin/${branch}`) || '0', 10);
    if (behind > 0) {
      console.error(`\nRefusing to sync: local ${branch} is ${behind} commit(s) behind origin/${branch}.\n`);
      console.error('Run: git pull');
      console.error('Then retry. Pass --skip-git-check to bypass (not recommended).\n');
      process.exit(4);
    }
  } catch {
    // Any unexpected git failure - skip the behind check, do not block sync
  }
}

preflightGit();

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set([
  'node_modules',
  'templates',
  'archive',
  '_source-documents',
  'images',
  'comments',
  '.git',
  '.github',
  '.claude',
  '.claude-plugin',
]);

function walkYaml(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkYaml(full, acc);
    else if (entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))) {
      acc.push(full);
    }
  }
  return acc;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
}

async function jiraFetch(endpoint, options = {}) {
  const url = `${JIRA_HOST}/rest/api/3${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${AUTH}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jira ${options.method || 'GET'} ${endpoint} failed: ${res.status} - ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Map sidecar status values to Jira transition names. Projects using
// non-standard workflow names can override via JIRA_STATUS_MAP env var,
// formatted as "completed=Done,in_progress=In Progress".
const DEFAULT_STATUS_MAP = {
  completed: 'Done',
  in_progress: 'In Progress',
  // backlog stays at the default "To Do" - no transition needed
};

function parseStatusMap() {
  const raw = process.env.JIRA_STATUS_MAP;
  if (!raw) return DEFAULT_STATUS_MAP;
  const out = { ...DEFAULT_STATUS_MAP };
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split('=').map((s) => s.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

const STATUS_MAP = parseStatusMap();

async function transitionIssue(key, targetName) {
  // Fetch available transitions for this issue, find one matching the
  // target name (case-insensitive), POST its ID.
  const { transitions } = await jiraFetch(`/issue/${key}/transitions`);
  const match = transitions.find(
    (t) => t.name.toLowerCase() === targetName.toLowerCase() ||
           (t.to && t.to.name && t.to.name.toLowerCase() === targetName.toLowerCase())
  );
  if (!match) {
    throw new Error(
      `No transition to "${targetName}" available on ${key}. ` +
      `Available: ${transitions.map((t) => t.name).join(', ')}`
    );
  }
  await jiraFetch(`/issue/${key}/transitions`, {
    method: 'POST',
    body: JSON.stringify({ transition: { id: match.id } }),
  });
}

function adfFromText(text) {
  // Minimal ADF doc wrapping plain text into paragraphs.
  return {
    type: 'doc',
    version: 1,
    content: text.split('\n\n').map((para) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: para || ' ' }],
    })),
  };
}

function relativePath(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function loadYaml(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    // Use JSON_SCHEMA so YYYY-MM-DD dates stay as strings
    return { data: yaml.load(raw, { schema: yaml.JSON_SCHEMA }), raw };
  } catch (err) {
    console.error(`Failed to parse ${relativePath(filePath)}: ${err.message}`);
    return null;
  }
}

function writeYaml(filePath, data) {
  const out = yaml.dump(data, { lineWidth: 0, sortKeys: false });
  fs.writeFileSync(filePath, out);
}

function loadMd(yamlPath) {
  // Find the companion markdown file for a sidecar YAML
  const dir = path.dirname(yamlPath);
  const base = path.basename(yamlPath, '.yaml');
  if (base === 'module' || base === 'epic') {
    const mdPath = path.join(dir, `${base}.md`);
    if (fs.existsSync(mdPath)) return { path: mdPath, content: fs.readFileSync(mdPath, 'utf8') };
  } else {
    // Story: S01.yaml -> S01-*.md
    const entries = fs.readdirSync(dir);
    const match = entries.find((e) => e.startsWith(`${base}-`) && e.endsWith('.md'));
    if (match) {
      const mdPath = path.join(dir, match);
      return { path: mdPath, content: fs.readFileSync(mdPath, 'utf8') };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Spec index - built before sync runs so we can resolve parent epic Jira keys
// ---------------------------------------------------------------------------

/**
 * Walk all sidecars and build a map of spec id -> jira_key for lookup during sync.
 * This lets us resolve a story's parent epic jira_key when we need to set it.
 */
function buildSpecIndex(allYamls) {
  const idToJira = new Map();
  const idToModule = new Map();
  for (const ymlPath of allYamls) {
    const loaded = loadYaml(ymlPath);
    if (!loaded) continue;
    const { data } = loaded;
    if (!data || typeof data !== 'object' || !data.id) continue;
    if (data.jira_key) idToJira.set(data.id, data.jira_key);
    if (data.module) idToModule.set(data.id, data.module);
  }
  return { idToJira, idToModule };
}

/**
 * Convert a module slug (e.g. "billing") into a human-readable label
 * used for Jira components and labels. Capitalises the first letter and
 * normalises "cross-cutting" style slugs.
 */
function moduleLabel(moduleSlug) {
  if (!moduleSlug) return null;
  if (moduleSlug === 'cross-cutting') return 'Cross-cutting';
  return moduleSlug.charAt(0).toUpperCase() + moduleSlug.slice(1);
}

// ---------------------------------------------------------------------------
// Sync logic
// ---------------------------------------------------------------------------

async function syncOne(yamlPath, specIndex) {
  const loaded = loadYaml(yamlPath);
  if (!loaded) return { status: 'error', reason: 'yaml parse' };
  const { data } = loaded;
  if (!data || typeof data !== 'object') return { status: 'skip', reason: 'invalid yaml' };

  // Modules are containers, not Jira tickets. They map to Jira components.
  if (data.type === 'module') return { status: 'skip', reason: 'module (maps to Jira component)' };

  // ADRs and research docs live in git only, not Jira
  if (data.type === 'adr' || data.type === 'research') {
    return { status: 'skip', reason: `${data.type} (git only)` };
  }

  const md = loadMd(yamlPath);
  if (!md) return { status: 'skip', reason: 'no companion md' };

  const contentHash = hashContent(md.content);
  const title = data.title || data.id;
  const relPath = relativePath(yamlPath);

  // Resolve parent epic Jira key if this is a story
  let parentJiraKey = null;
  if (data.type === 'story' && data.epic) {
    parentJiraKey = specIndex.idToJira.get(data.epic) || null;
    if (!parentJiraKey && args.apply) {
      console.warn(`[warn] ${data.id}: parent epic ${data.epic} has no jira_key yet - will link on next run`);
    }
  }

  // Build labels: module + 'project-master-managed' for filtering
  const labels = ['project-master-managed'];
  if (data.module) labels.push(`module-${data.module}`);

  // Build components array: one per module (if component exists in Jira).
  // Component names match moduleLabel() output (e.g. "billing" -> "Billing").
  const components = [];
  if (data.module) {
    const name = moduleLabel(data.module);
    if (name) components.push({ name });
  }

  // Case 1: no Jira key yet - create new issue
  if (!data.jira_key) {
    if (!args.apply) {
      console.log(`[dry] CREATE ${data.type} ${data.id} (${title})${parentJiraKey ? ` parent=${parentJiraKey}` : ''}`);
      return { status: 'create-dry', id: data.id };
    }

    const issueType = data.type === 'epic' ? 'Epic' : 'Story';
    const description = `${md.content}\n\n---\nSynced from ${relPath}`;
    const fields = {
      project: { key: JIRA_PROJECT },
      issuetype: { name: issueType },
      summary: `[${data.id}] ${title}`,
      description: adfFromText(description),
      labels,
    };
    if (components.length > 0) fields.components = components;
    if (parentJiraKey) {
      fields.parent = { key: parentJiraKey };
    }
    try {
      const result = await jiraFetch('/issue', {
        method: 'POST',
        body: JSON.stringify({ fields }),
      });
      data.jira_key = result.key;
      data.jira_sync_at = new Date().toISOString().slice(0, 10);
      data.jira_sync_hash = contentHash;
      writeYaml(yamlPath, data);
      console.log(`[apply] CREATED ${result.key} for ${data.id}${parentJiraKey ? ` (parent: ${parentJiraKey})` : ''}`);

      // Seed the new ticket's status from the sidecar. Jira creates every
      // ticket in the workflow's initial state ("To Do" on the default
      // template), which is wrong when the local spec has existing
      // completed/in_progress tracking. Transition immediately so the
      // initial bulk import reflects the true state of the project.
      const targetStatus = STATUS_MAP[data.status];
      if (targetStatus) {
        try {
          await transitionIssue(result.key, targetStatus);
          console.log(`[apply] TRANSITIONED ${result.key} to "${targetStatus}" (sidecar status: ${data.status})`);
        } catch (err) {
          console.warn(`[apply] WARN: could not transition ${result.key} to "${targetStatus}": ${err.message}`);
          // Non-fatal: the issue still exists, just in the wrong state.
          // User can transition manually or re-run after fixing workflow.
        }
      }

      // Also register in the spec index so subsequent stories in the same run
      // can resolve their parent epic
      specIndex.idToJira.set(data.id, result.key);
      return { status: 'created', id: data.id, jiraKey: result.key };
    } catch (err) {
      console.error(`[apply] FAILED to create ${data.id}: ${err.message}`);
      return { status: 'error', id: data.id, reason: err.message };
    }
  }

  // Case 2: has Jira key - check drift
  if (data.jira_sync_hash === contentHash) {
    if (args.verbose) console.log(`[skip] ${data.jira_key} unchanged (${data.id})`);
    return { status: 'unchanged', id: data.id, jiraKey: data.jira_key };
  }

  // Content has drifted - push update to Jira
  if (!args.apply) {
    console.log(`[dry] UPDATE ${data.jira_key} (${data.id}) - content drift detected`);
    return { status: 'update-dry', id: data.id, jiraKey: data.jira_key };
  }

  try {
    const description = `${md.content}\n\n---\nSynced from ${relPath}`;
    const updateFields = {
      description: adfFromText(description),
      labels,
    };
    if (components.length > 0) updateFields.components = components;
    if (parentJiraKey) {
      updateFields.parent = { key: parentJiraKey };
    }
    await jiraFetch(`/issue/${data.jira_key}`, {
      method: 'PUT',
      body: JSON.stringify({ fields: updateFields }),
    });
    data.jira_sync_at = new Date().toISOString().slice(0, 10);
    data.jira_sync_hash = contentHash;
    writeYaml(yamlPath, data);
    console.log(`[apply] UPDATED ${data.jira_key} for ${data.id}${parentJiraKey ? ` (parent: ${parentJiraKey})` : ''}`);
    return { status: 'updated', id: data.id, jiraKey: data.jira_key };
  } catch (err) {
    console.error(`[apply] FAILED to update ${data.jira_key}: ${err.message}`);
    return { status: 'error', id: data.id, reason: err.message };
  }
}

// ---------------------------------------------------------------------------
// Nesting fix pass - for existing stories with jira_key already set but
// whose parent link was never written to Jira. Runs before the main sync.
// ---------------------------------------------------------------------------

async function fixParentLinks(allYamls, specIndex) {
  const fixes = [];
  for (const ymlPath of allYamls) {
    const loaded = loadYaml(ymlPath);
    if (!loaded) continue;
    const { data } = loaded;
    if (!data || data.type !== 'story' || !data.jira_key || !data.epic) continue;

    const parentJiraKey = specIndex.idToJira.get(data.epic);
    if (!parentJiraKey) continue;

    fixes.push({ story: data.id, storyKey: data.jira_key, parentKey: parentJiraKey });
  }

  if (fixes.length === 0) return { attempted: 0, succeeded: 0, failed: 0 };

  if (!args.apply) {
    console.log(`\n[dry] ${fixes.length} stories would have parent links verified/set:`);
    for (const fix of fixes) {
      console.log(`  [dry] ${fix.storyKey} (${fix.story}) -> parent ${fix.parentKey}`);
    }
    return { attempted: fixes.length, succeeded: 0, failed: 0 };
  }

  console.log(`\nSetting parent links on ${fixes.length} existing stories...`);
  let succeeded = 0;
  let failed = 0;
  for (const fix of fixes) {
    try {
      await jiraFetch(`/issue/${fix.storyKey}`, {
        method: 'PUT',
        body: JSON.stringify({ fields: { parent: { key: fix.parentKey } } }),
      });
      console.log(`  [apply] ${fix.storyKey} -> parent ${fix.parentKey}`);
      succeeded++;
    } catch (err) {
      console.error(`  [apply] FAILED ${fix.storyKey}: ${err.message}`);
      failed++;
    }
  }
  return { attempted: fixes.length, succeeded, failed };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Project root: ${root}`);
  console.log(`Jira host:    ${JIRA_HOST}`);
  console.log(`Jira project: ${JIRA_PROJECT}`);

  const allYamls = walkYaml(target);
  console.log(`Found ${allYamls.length} sidecar YAMLs in ${relativePath(target) || '(root)'}`);
  console.log(args.apply ? 'APPLY MODE - changes will be pushed to Jira\n' : 'DRY RUN - no changes will be made (use --apply to push)\n');

  // Build spec index for parent lookup before doing any sync work
  const specIndex = buildSpecIndex(allYamls);
  console.log(`Indexed ${specIndex.idToJira.size} specs with existing Jira keys\n`);

  // Fix orphan parent links on existing stories first
  const parentFixes = await fixParentLinks(allYamls, specIndex);

  const results = {
    created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 0,
    dryCreate: 0, dryUpdate: 0,
    parentFixed: parentFixes.succeeded,
    parentFixesAttempted: parentFixes.attempted,
  };

  for (const yp of allYamls) {
    const result = await syncOne(yp, specIndex);
    switch (result.status) {
      case 'created': results.created++; break;
      case 'updated': results.updated++; break;
      case 'unchanged': results.unchanged++; break;
      case 'skip': results.skipped++; break;
      case 'error': results.errors++; break;
      case 'create-dry': results.dryCreate++; break;
      case 'update-dry': results.dryUpdate++; break;
    }
  }

  console.log('\nSummary:');
  if (args.apply) {
    console.log(`  Created: ${results.created}`);
    console.log(`  Updated: ${results.updated}`);
    console.log(`  Parent links fixed: ${results.parentFixed}/${results.parentFixesAttempted}`);
  } else {
    console.log(`  Would create: ${results.dryCreate}`);
    console.log(`  Would update: ${results.dryUpdate}`);
    console.log(`  Would fix parent links: ${results.parentFixesAttempted}`);
  }
  console.log(`  Unchanged: ${results.unchanged}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Errors: ${results.errors}`);

  if (results.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
