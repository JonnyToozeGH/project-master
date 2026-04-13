---
name: pm-validate
description: Run the ProjectMaster spec validator on the current project. Checks sidecar YAMLs, schemas, cross-references, and duplicate IDs.
---

# /pm-validate

Run the spec validator and report results.

## What you should do

1. **Locate the validator.** The validator script is at `${CLAUDE_PLUGIN_ROOT}/scripts/validate-specs.mjs`. It's designed to auto-detect the project root by walking up from `cwd`.

2. **Check for Node dependencies.** The validator needs `ajv`, `ajv-formats`, and `js-yaml`. If they're not in the plugin root's `node_modules/`, run `npm install` in the plugin root first.

3. **Run the validator:**

```bash
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT} node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-specs.mjs
```

Pass `CLAUDE_PLUGIN_ROOT` as an env var so the validator can find the schemas that shipped with the plugin.

4. **Report the output faithfully.** If validation passes, say so. If there are errors, show the first 10-15 errors verbatim and summarise how many total. If there are warnings, show them but don't block on them.

5. **Offer remediation.** For common errors like missing sidecars or broken references, explain the fix briefly and offer to apply it if the user agrees.

## Options

The user might append args like `--path specs/foo` or `--strict`. Pass them through to the script verbatim.

## Guardrails

- Don't modify any spec files automatically. Only offer fixes, let the user confirm.
- Don't run `npm install` outside the plugin root without asking.
- If the validator fails with "cannot find schemas directory", the plugin install is broken - tell the user to reinstall via `/plugin install project-master`.
