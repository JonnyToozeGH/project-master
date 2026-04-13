#!/usr/bin/env node
/**
 * Validate the spec system of any ProjectMaster-managed project.
 *
 * Checks:
 *  - Every spec .md has a matching sidecar .yaml companion and vice versa
 *  - All sidecar YAMLs validate against their JSON Schema (epic, story, module)
 *  - IDs in sidecars are unique across the repo
 *  - Cross-references (depends-on, blocks, epic parent) point at real IDs
 *  - Status enum values are valid
 *
 * Usage:
 *   node scripts/validate-specs.mjs                     # validate everything
 *   node scripts/validate-specs.mjs --path specs/foo    # validate a subtree
 *   node scripts/validate-specs.mjs --strict            # exit non-zero on warnings
 *   node scripts/validate-specs.mjs --project /path     # override project root detection
 *
 * Schema resolution (in order):
 *   1. CLAUDE_PLUGIN_ROOT/schemas/ (when run from a plugin install)
 *   2. <project-root>/schemas/ (when a project has its own schemas)
 *   3. <script-dir>/../schemas/ (when run from inside ProjectMaster itself)
 */

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { parseArgs } from 'node:util';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const { values: args } = parseArgs({
  options: {
    path: { type: 'string', default: '.' },
    strict: { type: 'boolean', default: false },
    project: { type: 'string' },
  },
});

// ---------------------------------------------------------------------------
// Resolve project root and schemas directory
// ---------------------------------------------------------------------------

const scriptDir = path.dirname(url.fileURLToPath(import.meta.url));
const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || null;

/**
 * Detect the project root. Walk up from cwd (or --project if given) and
 * stop at the first directory that either:
 *   (a) looks like a ProjectMaster project - has specs/, decisions/, or
 *       research/ AND also has a project boundary marker (.git, package.json)
 *   (b) is a project boundary (.git, package.json) with no spec folders -
 *       in which case we use it as the root and scanning will find nothing,
 *       which is the correct behaviour
 *
 * Crucially we never walk PAST a .git or package.json boundary. Without that
 * guard, running inside a sub-project would snap to an unrelated ancestor
 * that happened to have a specs/ folder.
 */
function detectProjectRoot() {
  if (args.project) return path.resolve(args.project);

  let cur = process.cwd();
  const stopAt = path.parse(cur).root;

  while (cur !== stopAt) {
    const isBoundary =
      fs.existsSync(path.join(cur, '.git')) ||
      fs.existsSync(path.join(cur, 'package.json'));
    const hasSpecFolder =
      fs.existsSync(path.join(cur, 'specs')) ||
      fs.existsSync(path.join(cur, 'decisions')) ||
      fs.existsSync(path.join(cur, 'research'));

    if (isBoundary) return cur;
    if (hasSpecFolder) return cur;

    cur = path.dirname(cur);
  }

  // Fallback: current directory
  return process.cwd();
}

/**
 * Locate the schemas directory. Try plugin root first, then project-local,
 * then the ProjectMaster dev checkout.
 */
function detectSchemasDir(projectRoot) {
  const candidates = [];

  if (pluginRoot) candidates.push(path.join(pluginRoot, 'schemas'));
  candidates.push(path.join(projectRoot, 'schemas'));
  candidates.push(path.join(scriptDir, '..', 'schemas'));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return null;
}

const root = detectProjectRoot();
const schemasDir = detectSchemasDir(root);
const targetPath = path.resolve(root, args.path === '.' ? '' : args.path);

if (!schemasDir) {
  console.error('Cannot find schemas directory. Searched:');
  if (pluginRoot) console.error(`  - ${path.join(pluginRoot, 'schemas')} (CLAUDE_PLUGIN_ROOT)`);
  console.error(`  - ${path.join(root, 'schemas')} (project root)`);
  console.error(`  - ${path.join(scriptDir, '..', 'schemas')} (script dir)`);
  process.exit(2);
}

// ---------------------------------------------------------------------------
// Load schemas
// ---------------------------------------------------------------------------

function readSchema(name) {
  try {
    return JSON.parse(fs.readFileSync(path.join(schemasDir, name), 'utf8'));
  } catch {
    return null;
  }
}

const epicSchema = readSchema('epic.schema.json');
const storySchema = readSchema('story.schema.json');
const moduleSchema = readSchema('module.schema.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validateEpic = epicSchema ? ajv.compile(epicSchema) : () => true;
const validateStory = storySchema ? ajv.compile(storySchema) : () => true;
const validateModule = moduleSchema ? ajv.compile(moduleSchema) : () => true;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const errors = [];
const warnings = [];
const idIndex = new Map(); // id -> file path

// Directories we should never treat as real spec content.
// Dot-prefixed directories (.git, .next, .turbo, .mastra, .serena, etc.)
// are already skipped by the walker's startsWith('.') check.
const SKIP_DIRS = new Set([
  'node_modules',
  'templates',
  'archive',
  '_source-documents',
  'images',
  'comments',
  // Build outputs and caches
  'dist',
  'build',
  'out',
  'coverage',
  'target',
  // Package workspace noise
  'bmad-studio',
]);

// Sidecar YAMLs follow a strict naming convention. Any other .yaml file in
// the tree (docker-compose.yaml, pnpm-lock.yaml, random config files) is not
// a ProjectMaster sidecar and must not be schema-validated.
const SIDECAR_YAML_PATTERN = /^(module|epic|S\d+)\.ya?ml$/i;

// Spec markdown files also follow a convention: module.md, epic.md, or
// S<NN>-<slug>.md. Other markdown (README, random docs) is not a spec file.
const SPEC_MD_PATTERN = /^(module|epic|S\d+-.+)\.md$/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function walk(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.isFile()) acc.push(full);
  }
  return acc;
}

function relativeToRoot(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function loadYaml(filePath) {
  try {
    // Use JSON_SCHEMA so YYYY-MM-DD dates stay as strings
    return yaml.load(fs.readFileSync(filePath, 'utf8'), { schema: yaml.JSON_SCHEMA });
  } catch (err) {
    errors.push(`${relativeToRoot(filePath)}: YAML parse error - ${err.message}`);
    return null;
  }
}

function recordId(id, filePath) {
  if (!id) return;
  if (idIndex.has(id)) {
    errors.push(
      `Duplicate ID '${id}' in ${relativeToRoot(filePath)} (also in ${relativeToRoot(idIndex.get(id))})`
    );
  } else {
    idIndex.set(id, filePath);
  }
}

function checkMdHasSidecar(mdFile) {
  const dir = path.dirname(mdFile);
  const base = path.basename(mdFile, '.md');

  // Skip non-spec markdown
  if (base === 'README' || base.toLowerCase() === 'readme') return;

  if (base === 'module' || base === 'epic') {
    const yamlFile = path.join(dir, `${base}.yaml`);
    if (!fs.existsSync(yamlFile)) {
      errors.push(`${relativeToRoot(mdFile)}: missing sidecar ${base}.yaml`);
    }
    return;
  }

  // Story convention: S01-title.md -> S01.yaml
  const storyMatch = base.match(/^(S\d+)-/);
  if (storyMatch) {
    const sidecar = path.join(dir, `${storyMatch[1]}.yaml`);
    if (!fs.existsSync(sidecar)) {
      errors.push(`${relativeToRoot(mdFile)}: missing sidecar ${storyMatch[1]}.yaml`);
    }
  }
}

function checkYamlHasMd(yamlFile) {
  const dir = path.dirname(yamlFile);
  const base = path.basename(yamlFile, '.yaml');

  if (base === 'module' || base === 'epic') {
    const mdFile = path.join(dir, `${base}.md`);
    if (!fs.existsSync(mdFile)) {
      errors.push(`${relativeToRoot(yamlFile)}: missing companion ${base}.md`);
    }
    return;
  }

  // Story sidecar: S01.yaml -> must have S01-*.md
  const storyMatch = base.match(/^S\d+$/);
  if (storyMatch) {
    const entries = fs.readdirSync(dir);
    const expectedPrefix = `${base}-`;
    const hasMatch = entries.some((e) => e.startsWith(expectedPrefix) && e.endsWith('.md'));
    if (!hasMatch) {
      errors.push(`${relativeToRoot(yamlFile)}: no companion ${base}-*.md found`);
    }
  }
}

function validateSidecar(yamlFile) {
  const data = loadYaml(yamlFile);
  if (!data) return;
  if (typeof data !== 'object' || data === null) return;

  recordId(data.id, yamlFile);

  const type = data.type;
  let validator = null;

  if (type === 'epic') validator = validateEpic;
  else if (type === 'story') validator = validateStory;
  else if (type === 'module') validator = validateModule;

  if (validator) {
    if (!validator(data)) {
      for (const err of validator.errors || []) {
        errors.push(`${relativeToRoot(yamlFile)}: ${err.instancePath} ${err.message}`);
      }
    }
  } else if (type === 'task' || type === 'adr' || type === 'research') {
    // No schema yet - basic checks only
    if (!data.id) warnings.push(`${relativeToRoot(yamlFile)}: missing id`);
  } else if (!type) {
    warnings.push(`${relativeToRoot(yamlFile)}: missing 'type' field`);
  } else {
    warnings.push(`${relativeToRoot(yamlFile)}: unknown type '${type}'`);
  }
}

function crossReferenceCheck() {
  for (const [id, file] of idIndex.entries()) {
    const data = loadYaml(file);
    if (!data || typeof data !== 'object') continue;

    const refs = [
      ...((data['depends-on']) || []),
      ...((data.blocks) || []),
    ];

    for (const ref of refs) {
      // Ignore Jira-style keys (PROJECT-NNN)
      if (/^[A-Z]+-\d+$/.test(ref) && !idIndex.has(ref)) {
        // This looks like a Jira key rather than a spec id - silently ignore
        continue;
      }
      if (!idIndex.has(ref)) {
        warnings.push(`${relativeToRoot(file)}: reference '${ref}' does not resolve to any known spec id`);
      }
    }

    // Story must have a valid epic parent
    if (data.type === 'story' && data.epic && !idIndex.has(data.epic)) {
      errors.push(`${relativeToRoot(file)}: story references unknown epic '${data.epic}'`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  if (!fs.existsSync(targetPath)) {
    console.error(`Target path does not exist: ${targetPath}`);
    process.exit(2);
  }

  console.log(`Project root: ${root}`);
  console.log(`Schemas dir:  ${schemasDir}`);
  console.log(`Scanning:     ${relativeToRoot(targetPath) || '(root)'}\n`);

  const files = walk(targetPath);
  const mdFiles = files.filter((f) => SPEC_MD_PATTERN.test(path.basename(f)));
  const yamlFiles = files.filter((f) => SIDECAR_YAML_PATTERN.test(path.basename(f)));

  for (const md of mdFiles) checkMdHasSidecar(md);

  for (const yml of yamlFiles) {
    checkYamlHasMd(yml);
    validateSidecar(yml);
  }

  crossReferenceCheck();

  console.log(`Found ${idIndex.size} unique IDs across ${yamlFiles.length} sidecar YAMLs`);

  if (warnings.length > 0) {
    console.log(`\n${warnings.length} warnings:`);
    for (const w of warnings) console.log(`  warn: ${w}`);
  }

  if (errors.length > 0) {
    console.log(`\n${errors.length} errors:`);
    for (const e of errors) console.log(`  error: ${e}`);
    process.exit(1);
  }

  if (warnings.length > 0 && args.strict) {
    console.log('\nStrict mode: failing due to warnings');
    process.exit(1);
  }

  console.log('\nAll checks passed.');
}

main();
