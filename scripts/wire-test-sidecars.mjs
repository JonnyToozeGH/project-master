#!/usr/bin/env node
/**
 * Sidecar Wiring - updates test_refs and test_status in story sidecar YAMLs
 * based on the existence (and optionally pass/fail state) of test files.
 *
 * Usage:
 *   node wire-test-sidecars.mjs <specs-root> <test-root>
 *   node wire-test-sidecars.mjs specs tests/specs         # typical usage
 *
 * Options:
 *   --dry-run    Show what would change without writing (default)
 *   --apply      Write changes to sidecar YAMLs
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const positional = args.filter(a => !a.startsWith('--'));
const specsRoot = positional[0] || 'specs';
const testRoot = positional[1] || 'tests/specs';

/**
 * Find all story sidecar YAMLs in the specs tree.
 */
function findSidecars(dir) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', 'templates', 'archive'].includes(e.name)) continue;
      results.push(...findSidecars(full));
    } else if (e.isFile() && /^S\d+\.yaml$/.test(e.name)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Compute the expected test file path for a story sidecar.
 * Module directory is derived from the sidecar's filesystem location
 * (specs/<moduleDir>/<epicDir>/SNN.yaml) rather than a hardcoded map,
 * so this works for any module names a project chooses.
 */
function expectedTestPath(sidecarPath, specsRoot, testRoot) {
  const content = fs.readFileSync(sidecarPath, 'utf8');

  const idMatch = content.match(/^id:\s*(.+)$/m);
  const epicMatch = content.match(/^epic:\s*(.+)$/m);
  if (!idMatch || !epicMatch) return null;

  const storyId = idMatch[1].trim();
  const epicId = epicMatch[1].trim();

  // Derive module directory from the sidecar's path relative to specsRoot.
  const rel = path.relative(specsRoot, sidecarPath);
  const moduleDir = rel.split(path.sep)[0];
  if (!moduleDir) return null;

  const storyNum = storyId.match(/S(\d+)$/)?.[1];
  if (!storyNum) return null;

  return path.join(testRoot, moduleDir, epicId, `S${storyNum.padStart(2, '0')}.spec.ts`);
}

/**
 * Update a sidecar YAML's test_refs and test_status fields.
 */
function updateSidecar(sidecarPath, testPath, testExists) {
  let content = fs.readFileSync(sidecarPath, 'utf8');
  let changed = false;

  // Normalise test path for YAML (forward slashes)
  const normPath = testPath.replace(/\\/g, '/');

  // Update test_refs
  const newRefsValue = testExists ? `\n  - ${normPath}` : ' []';
  if (content.match(/^test_refs:\s*\[?\]?$/m)) {
    const updated = content.replace(/^test_refs:.*$/m, `test_refs:${newRefsValue}`);
    if (updated !== content) { content = updated; changed = true; }
  } else if (content.match(/^test_refs:$/m)) {
    // Multi-line format - replace whole block
    const updated = content.replace(/^test_refs:\n(?:\s+-\s+.+\n)*/m, `test_refs:${newRefsValue}\n`);
    if (updated !== content) { content = updated; changed = true; }
  }

  // Update test_status
  const newStatus = testExists ? 'failing' : 'missing';
  const statusRegex = /^test_status:\s*.+$/m;
  if (statusRegex.test(content)) {
    const updated = content.replace(statusRegex, `test_status: ${newStatus}`);
    if (updated !== content) { content = updated; changed = true; }
  }

  return { content, changed };
}

// --- Main ---
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);
console.log(`Specs: ${specsRoot}`);
console.log(`Tests: ${testRoot}\n`);

const sidecars = findSidecars(specsRoot);
let updated = 0;
let unchanged = 0;
let noMapping = 0;

for (const sc of sidecars) {
  const testPath = expectedTestPath(sc, specsRoot, testRoot);
  if (!testPath) {
    noMapping++;
    continue;
  }

  const testExists = fs.existsSync(testPath);
  const { content, changed } = updateSidecar(sc, testPath, testExists);

  const relSc = path.relative('.', sc);
  const relTest = path.relative('.', testPath);
  const status = testExists ? 'failing' : 'missing';

  if (changed) {
    console.log(`  UPDATE ${relSc} -> test_status: ${status}, test_refs: ${testExists ? relTest : '[]'}`);
    if (!dryRun) {
      fs.writeFileSync(sc, content, 'utf8');
    }
    updated++;
  } else {
    unchanged++;
  }
}

console.log(`\n${updated} updated, ${unchanged} unchanged, ${noMapping} skipped (no mapping)`);
if (dryRun && updated > 0) {
  console.log('Run with --apply to write changes.');
}
