#!/usr/bin/env node
/**
 * AC Parser - extracts acceptance criteria from story markdown files.
 *
 * Usage:
 *   node parse-acs.mjs <story.md>              # single file, JSON to stdout
 *   node parse-acs.mjs <epic-folder>/           # all stories in an epic
 *   node parse-acs.mjs --all <specs-root>       # all stories in all epics
 *
 * Output: JSON array of { storyId, storyTitle, module, epicId, acs: [{ acId, title, given, when, then }] }
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * Parse a single story markdown file and extract structured ACs.
 */
function parseStoryFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Extract frontmatter id
  const idMatch = content.match(/^---[\s\S]*?^id:\s*(.+)$/m);
  const storyId = idMatch ? idMatch[1].trim() : path.basename(filePath, '.md');

  // Extract title from first # heading
  const titleMatch = content.match(/^#\s+Story\s+S\d+:\s*(.+)$/m);
  const storyTitle = titleMatch ? titleMatch[1].trim() : '';

  // Extract module
  const moduleMatch = content.match(/\*\*Module:\*\*\s*(.+)/);
  const module = moduleMatch ? moduleMatch[1].trim().replace(/\[|\]|\(.*?\)/g, '').trim() : '';

  // Extract epic ID from the epic backlink
  const epicMatch = content.match(/\*\*Epic:\*\*\s*\[([A-Z]+-E\d+)/);
  const epicId = epicMatch ? epicMatch[1] : '';

  // Extract ACs
  const acs = [];
  const acRegex = /^###\s+AC(\d+):\s*(.+)$/gm;
  let match;

  while ((match = acRegex.exec(content)) !== null) {
    const acNum = match[1];
    const acTitle = match[2].trim();
    const acStart = match.index + match[0].length;

    // Find the end of this AC block (next ### or ## or EOF)
    const nextSection = content.slice(acStart).search(/^##/m);
    const acBody = nextSection >= 0
      ? content.slice(acStart, acStart + nextSection)
      : content.slice(acStart);

    // Extract Given/When/Then
    const givenMatch = acBody.match(/\*\*Given\*\*\s*(.+?)(?=\n\*\*When\*\*|\n\*\*Then\*\*|\n###|\n##|$)/s);
    const whenMatch = acBody.match(/\*\*When\*\*\s*(.+?)(?=\n\*\*Then\*\*|\n###|\n##|$)/s);
    const thenMatch = acBody.match(/\*\*Then\*\*\s*(.+?)(?=\n\*\*Given\*\*|\n###|\n##|$)/s);

    acs.push({
      acId: `AC${acNum}`,
      title: acTitle,
      given: givenMatch ? givenMatch[1].trim() : '',
      when: whenMatch ? whenMatch[1].trim() : '',
      then: thenMatch ? thenMatch[1].trim() : '',
    });
  }

  return { storyId, storyTitle, module, epicId, filePath, acs };
}

/**
 * Find all story markdown files in a directory.
 */
function findStoryFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip non-spec directories
      if (['node_modules', '.git', 'templates', 'archive', '_source-documents'].includes(entry.name)) continue;
      files.push(...findStoryFiles(fullPath));
    } else if (entry.isFile() && /^S\d+-.*\.md$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// --- CLI ---
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node parse-acs.mjs <story.md | epic-folder/ | --all specs-root>');
  process.exit(1);
}

let files;
if (args[0] === '--all') {
  const root = args[1] || 'specs';
  files = findStoryFiles(root);
} else {
  const target = args[0];
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    files = findStoryFiles(target);
  } else {
    files = [target];
  }
}

const results = files.map(f => parseStoryFile(f));
const totalACs = results.reduce((sum, r) => sum + r.acs.length, 0);

if (process.stderr.isTTY) {
  console.error(`Parsed ${results.length} stories, ${totalACs} acceptance criteria`);
}

console.log(JSON.stringify(results, null, 2));
