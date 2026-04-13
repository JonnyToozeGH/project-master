# ProjectMaster

A spec-driven development toolkit for Claude Code. Ships an opinionated spec hierarchy, JSON schema validation, Jira sync, and scaffolding slash commands so any project can adopt the same conventions immediately.

Built from the lessons of running a multi-module SaaS platform on a spec-as-code basis. The goal: make it trivial to bootstrap a new project with the same discipline - every epic is specced, every story has acceptance criteria, every spec is a live Jira ticket.

## Status

**v0.1 - early release, unstable.** APIs and conventions may change. Expect rough edges.

## Why

Most engineering teams end up with three diverging sources of truth: the docs they wrote when the project started, the tickets in Jira, and the code that actually exists. ProjectMaster collapses this into one canonical spec repo:

- **Spec content lives in git** as markdown (human-editable, diff-able, reviewable)
- **Spec metadata lives in sidecar YAML** (machine-readable, schema-validated)
- **Jira mirrors the spec** via a sync script (one Jira ticket per spec file, drift detection via SHA256 content hash)
- **Validation runs in CI** so broken specs never merge

The result: one place to author, one place to review, one place to track. The spec is the source of truth; everything else reflects it.

## What you get

### Commands

- `/pm-init` - Scaffold a new project with the full spec folder structure
- `/pm-add-epic` - Create a new epic interactively
- `/pm-add-story` - Create a new story with acceptance criteria
- `/pm-add-adr` - Create a new Architecture Decision Record
- `/pm-validate` - Run the spec validator (JSON schema check, cross-reference resolution, uniqueness)
- `/pm-sync-jira` - Bidirectional sync with a Jira project

### Spec hierarchy

```
Module (the biggest container, e.g. "Billing", "Onboarding")
 └── Epic (a chunk of work, e.g. "Subscription renewal flow")
      └── Story (a unit of execution with acceptance criteria)
```

Plus cross-cutting concerns that span modules:

- **Architecture Decision Records** (`decisions/`) - MADR format, numbered ADRs
- **Research docs** (`research/`) - investigations and analysis
- **Call notes / team updates** (`docs/`) - living documentation

### File conventions

Every spec file has two parts:

- `epic.md` / `story-NN.md` - human-readable markdown (vision, ACs, dev notes)
- `epic.yaml` / `SNN.yaml` - machine-readable metadata (status, owner, Jira key, dependencies, test coverage)

This keeps the prose clean while giving tooling structured data. See `templates/` for the full format.

### Validation

- JSON schemas in `schemas/` for epic, story, module sidecars
- Uniqueness check (no duplicate IDs across the repo)
- Cross-reference resolution (`depends-on`, `blocks`, epic parent must point at real IDs)
- Missing sidecar check (every md has a yaml and vice versa)
- Run locally: `node scripts/validate-specs.mjs`
- Or via the `/pm-validate` command
- Or in CI via `docs/ci/validate-specs.yml.template`

### Jira sync

- Dry-run by default (see what would change without touching Jira)
- Creates new issues for files with `jira_key: null`, writes the returned key back
- Detects content drift via SHA256 hash on the markdown, updates Jira description if changed
- Principles: git canonical for content, Jira canonical for status transitions, one Jira ticket per spec file, deletion is manual only

## Installation

### As a Claude Code plugin (recommended)

```bash
# Add the marketplace (one-time setup)
/plugin marketplace add JonnyToozeGH/project-master

# Install
/plugin install project-master
```

### Manual (for contributing to ProjectMaster itself)

```bash
git clone https://github.com/JonnyToozeGH/project-master.git
cd project-master
npm install
```

## Quickstart

In a fresh or existing project:

```bash
# 1. Initialise the spec structure
/pm-init

# 2. Create your first epic
/pm-add-epic

# 3. Add some stories to it
/pm-add-story

# 4. Write an ADR to capture a key decision
/pm-add-adr

# 5. Validate everything
/pm-validate

# 6. Configure Jira env vars and sync
export JIRA_HOST=https://your-org.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=...
export JIRA_PROJECT=PROJ
/pm-sync-jira                 # dry run first
/pm-sync-jira                 # then apply (on explicit confirmation)
```

## Opinions

ProjectMaster is deliberately opinionated. v0.1 does not support custom conventions. This is on purpose: opinionated software ships faster and the conventions encoded here come from real production use. If you disagree with a convention, open an issue - don't fork.

Specifically:

- **Module > Epic > Story hierarchy is the only supported structure.** Flat ticket lists or free-form are not supported.
- **Sidecar YAML is the only supported metadata location.** No YAML frontmatter in the markdown.
- **JSON schemas are enforced.** All sidecars must validate.
- **Status enums are fixed.** You can't add new statuses (backlog, ready-for-dev, in-progress, review, done, blocked, superseded).
- **Jira sync is one-way for content.** Git wins. Jira wins for status.
- **ADRs are MADR.** No other format.
- **Templates are mandatory starting points.** Hand-authoring without the template is allowed but not encouraged.

## Roadmap

**v0.2:**
- `/pm-analyse` - reverse-engineer a spec hierarchy from an existing codebase
- `/pm-add-module` - module scaffolding
- `/pm-generate-tests` - convert acceptance criteria into failing test stubs
- `.pm-config.json` for per-project customisation (module list, Jira defaults, status names)

**v0.3:**
- Pre-commit hook for spec validation
- Claude Code hooks (post-edit validation, auto-sync on merge)
- Test coverage tracking in sidecars
- Coverage-to-story traceability matrix

**v0.4+:**
- GitHub Issues sync (alongside Jira)
- ADR supersession helper
- Spec search and cross-reference graph

## Contributing

Open an issue on the repo if you want to discuss changes or contribute.

## Licence

MIT. See [LICENSE](./LICENSE).

## Acknowledgements

- **GitHub Spec Kit** for the Spec Driven Development pattern and `FR-###` / `SC-###` ID discipline
- **BMAD Method** for the module > epic > story hierarchy and the `Ready-for-Dev` status semantics
- **MADR** for the Markdown ADR format
- **Kubernetes KEP process** for the sidecar metadata pattern
