#!/usr/bin/env node
/**
 * Test Stub Generator - creates failing .spec.ts files from parsed ACs.
 *
 * Usage:
 *   node generate-test-stubs.mjs <story.md>           # single story
 *   node generate-test-stubs.mjs <epic-folder>/        # all stories in an epic
 *   node generate-test-stubs.mjs --all <specs-root>    # all stories
 *
 * Options:
 *   --test-root <dir>   Output root (default: tests/specs)
 *   --force             Overwrite existing test files (default: skip)
 *
 * Output: test files at <test-root>/<module>/<epic-id>/S0N.spec.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

// Resolve the parser relative to this script
const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const PARSER = path.join(SCRIPT_DIR, 'parse-acs.mjs');

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { testRoot: 'tests/specs', force: false, targets: [] };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--test-root') { opts.testRoot = args[++i]; continue; }
    if (args[i] === '--force') { opts.force = true; continue; }
    opts.targets.push(args[i]);
  }
  return opts;
}

function readCodeRefs(storyMdPath) {
  // Try to read the sidecar YAML for code_refs
  const dir = path.dirname(storyMdPath);
  const base = path.basename(storyMdPath);
  const sidecarMatch = base.match(/^(S\d+)-/);
  if (!sidecarMatch) return [];

  const sidecarPath = path.join(dir, `${sidecarMatch[1]}.yaml`);
  if (!fs.existsSync(sidecarPath)) return [];

  const yaml = fs.readFileSync(sidecarPath, 'utf8');
  const refs = [];
  let inCodeRefs = false;
  for (const line of yaml.split('\n')) {
    if (/^code_refs:/.test(line)) { inCodeRefs = true; continue; }
    if (inCodeRefs && /^\s+-\s+/.test(line)) {
      refs.push(line.replace(/^\s+-\s+/, '').replace(/^>-?\s*/, '').trim());
    } else if (inCodeRefs && /^\S/.test(line)) {
      break;
    }
  }
  return refs;
}

function escapeComment(text) {
  return text.replace(/\*\//g, '* /').replace(/`/g, "'");
}

function escapeString(text) {
  // Remove markdown backticks and escape single quotes for JS single-quoted strings
  return text.replace(/`/g, '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function generateStub(story, codeRefs) {
  const lines = [];
  lines.push("import { describe, it, expect } from 'vitest';");
  lines.push('');

  if (codeRefs.length > 0) {
    lines.push('// TODO: import from the relevant app/package');
    lines.push('// Suggested code refs:');
    for (const ref of codeRefs) {
      lines.push(`//   - ${ref}`);
    }
    lines.push('');
  }

  lines.push(`describe('${escapeString(story.storyId)}: ${escapeString(story.storyTitle)}', () => {`);

  for (const ac of story.acs) {
    lines.push('');
    lines.push(`  it('${escapeString(ac.acId)}: ${escapeString(ac.title)}', () => {`);
    if (ac.given) lines.push(`    // Given ${escapeComment(ac.given)}`);
    if (ac.when) lines.push(`    // When ${escapeComment(ac.when)}`);
    if (ac.then) lines.push(`    // Then ${escapeComment(ac.then)}`);
    lines.push("    expect(true).toBe(false); // TODO: implement");
    lines.push('  });');
  }

  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

function moduleToDir(module) {
  if (!module) return 'unknown';
  return module.toLowerCase().replace(/\s+/g, '-');
}

// --- Main ---
const opts = parseArgs();

if (opts.targets.length === 0) {
  console.error('Usage: node generate-test-stubs.mjs <story.md | epic-folder/ | --all specs-root>');
  process.exit(1);
}

// Run parser
const parserArgs = opts.targets[0] === '--all'
  ? ['--all', opts.targets[1] || 'specs']
  : [opts.targets[0]];

const raw = execFileSync('node', [PARSER, ...parserArgs], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
const stories = JSON.parse(raw);

let created = 0;
let skipped = 0;
let totalACs = 0;

for (const story of stories) {
  if (story.acs.length === 0) {
    console.log(`  SKIP ${story.storyId}: no ACs found`);
    skipped++;
    continue;
  }

  const moduleDir = moduleToDir(story.module);
  const epicId = story.epicId;
  const storyNum = story.storyId.match(/S(\d+)$/)?.[1] || '01';
  const outDir = path.join(opts.testRoot, moduleDir, epicId);
  const outFile = path.join(outDir, `S${storyNum.padStart(2, '0')}.spec.ts`);

  if (fs.existsSync(outFile) && !opts.force) {
    console.log(`  SKIP ${story.storyId}: ${outFile} already exists`);
    skipped++;
    continue;
  }

  const codeRefs = readCodeRefs(story.filePath);
  const content = generateStub(story, codeRefs);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, content, 'utf8');
  console.log(`  CREATE ${outFile} (${story.acs.length} ACs)`);
  created++;
  totalACs += story.acs.length;
}

console.log(`\n${created} created, ${skipped} skipped, ${totalACs} acceptance criteria`);
