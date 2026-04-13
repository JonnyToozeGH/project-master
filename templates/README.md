# Spec Templates

Canonical templates for ProjectMaster's spec hierarchy. Used by the `/pm-init` command to scaffold new projects, and available as a reference for hand-authoring specs.

## Files

| File | Purpose |
|------|---------|
| `module.md` / `module.yaml` | Top-level module spec (e.g. "Billing", "Onboarding") |
| `epic.md` / `epic.yaml` | Epic spec (a chunk of work within a module) |
| `story.md` / `story.yaml` | Individual story with acceptance criteria |
| `adr.md` | Architecture Decision Record (MADR-style) |

## Hierarchy

```
Module       <-- module.md + module.yaml
 └── Epic    <-- epic.md + epic.yaml
      └── Story  <-- S01-title.md + S01.yaml
```

## Sidecar YAML pattern

Every spec `.md` file has a matching `.yaml` sidecar with the same base name. The sidecar holds machine-readable metadata (id, status, owner, Jira key, dependencies, test coverage) that the validator and Jira sync tools read.

Why separate? It keeps the human-readable markdown clean (no YAML frontmatter clutter) while still giving tooling structured data to work with. When editing specs in any markdown editor (including TOME), authors work with just the prose.

## Placeholders

Templates use `{{placeholder}}` syntax for variables. When scaffolding:

- `{{module_prefix}}` - module ID (e.g. `BILL`)
- `{{epic_num}}` / `{{epic_id}}` - epic number/ID (e.g. `E01`, `BILL-E01`)
- `{{story_num}}` - story number (e.g. `S01`)
- `{{title}}` - human-readable title
- `{{module}}` - module slug (lowercase, e.g. `billing`)
- `{{date}}` - ISO date (YYYY-MM-DD)
- `{{author}}` - author name

The `/pm-init` command does placeholder substitution automatically. If you hand-author, just replace them yourself.

## Validation

Every sidecar must validate against the JSON schema in `schemas/`:

- `epic.yaml` → `schemas/epic.schema.json`
- `story.yaml` → `schemas/story.schema.json`
- `module.yaml` → `schemas/module.schema.json`

Run `node scripts/validate-specs.mjs` to check all specs in a project.
