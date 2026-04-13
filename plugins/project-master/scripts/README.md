# ProjectMaster Scripts

Runtime tooling for ProjectMaster-managed projects.

## `validate-specs.mjs`

Validates a project's spec system. Auto-detects the project root by walking up from the current directory looking for `specs/`, `decisions/`, or `research/`. Schemas are resolved in this order:

1. `$CLAUDE_PLUGIN_ROOT/schemas/` (when run from a plugin install)
2. `<project-root>/schemas/` (when a project has its own schemas)
3. `<script-dir>/../schemas/` (when run from inside ProjectMaster itself)

**Usage:**

```bash
# Dry-run from any directory inside a project
node scripts/validate-specs.mjs

# Validate a subtree
node scripts/validate-specs.mjs --path specs/foo

# Treat warnings as errors (strict mode)
node scripts/validate-specs.mjs --strict

# Override project root detection
node scripts/validate-specs.mjs --project /path/to/spec/root
```

**Checks:**
- Every spec md has a sidecar yaml and vice versa
- Sidecars validate against JSON schemas (epic, story, module)
- IDs are unique across the repo
- Cross-references (depends-on, blocks, epic parent) resolve to real IDs
- Skips `templates/`, `archive/`, `_source-documents/`, `node_modules/`, `.git/`, `.claude*/` etc

## `sync-jira.mjs`

Bidirectional sync between sidecar YAMLs and a Jira project. Git is canonical for content; Jira is canonical for status transitions.

**Environment variables required:**

```bash
export JIRA_HOST=https://your-org.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=<token>
export JIRA_PROJECT=PROJ
```

Get an API token at https://id.atlassian.com/manage-profile/security/api-tokens.

**Usage:**

```bash
# Dry run - reports what would change without touching Jira
node scripts/sync-jira.mjs

# Actually push changes
node scripts/sync-jira.mjs --apply

# Limit to a subtree
node scripts/sync-jira.mjs --only specs/module-foo

# Verbose output (show unchanged items)
node scripts/sync-jira.mjs --verbose
```

**What happens:**
- Files with `jira_key: null` get new Jira issues created. The returned key is written back to the sidecar.
- Files with existing `jira_key` get a content hash check. If the markdown has drifted, the Jira description is updated.
- `jira_sync_hash` stores a SHA-256 of the md content so subsequent runs can skip unchanged files instantly.

**Skipped file types:**
- Modules (map to Jira components, not issues)
- ADRs (git only)
- Research docs (git only)
- Files without a companion markdown

## Installing the validator in CI

See `docs/ci/validate-specs.yml.template` for a GitHub Actions workflow template that runs the validator on every PR.
