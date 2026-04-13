# ProjectMaster Quickstart

Go from zero to a working spec system in 5 minutes.

## Prerequisites

- Claude Code installed
- Node.js 20+ (for running the validator and sync scripts directly)
- An existing project (can be empty) where you want to manage specs

## Step 1: Install the plugin

```bash
# In Claude Code
/plugin marketplace add JonnyToozeGH/project-master
/plugin install project-master
```

## Step 2: Initialise your project

`cd` into your project and run:

```bash
/pm-init
```

This creates:

```
./
├── README.md
├── constitution.md
├── docs/
│   ├── stakeholders/
│   ├── developers/
│   └── call-notes/
├── architecture/
├── decisions/
├── specs/
├── research/
├── planning/
└── schemas/
```

Commit the initial scaffold:

```bash
git add .
git commit -m "chore: initialise ProjectMaster spec system"
```

## Step 3: Create your first epic

```bash
/pm-add-epic
```

You'll be asked:
- Which module (or if this is your first, which module to create)
- Title
- Vision (one paragraph)
- Priority (P1/P2/P3)
- Owner

The command creates `specs/<module>/<PREFIX>-E01-<slug>/epic.md` and `epic.yaml`.

## Step 4: Break the epic into stories

```bash
/pm-add-story
```

You'll be asked:
- Which epic (pick from the list)
- Title
- User story (As X I want Y so that Z)
- Acceptance criteria in Given/When/Then format
- Owner
- Dev notes and dependencies

The command creates `S01-<slug>.md` and `S01.yaml` in the epic folder, and updates the epic.yaml to include this story.

Repeat for each story in the epic.

## Step 5: Capture key decisions

As you make architectural or commercial decisions, record them:

```bash
/pm-add-adr
```

ADRs live in `decisions/NNNN-kebab-title.md`. They're numbered, immutable once accepted, and cited from the epics and stories that depend on them.

## Step 6: Validate

```bash
/pm-validate
```

This runs the spec validator and reports any issues:
- Missing sidecars
- Schema violations
- Duplicate IDs
- Broken cross-references

Fix any errors. Warnings are safe to leave but worth reviewing.

## Step 7: Configure Jira

Set environment variables in your shell (or a git-ignored `.env.local`):

```bash
export JIRA_HOST=https://your-org.atlassian.net
export JIRA_EMAIL=you@example.com
export JIRA_API_TOKEN=...
export JIRA_PROJECT=PROJ
```

Get an API token at https://id.atlassian.com/manage-profile/security/api-tokens.

## Step 8: Sync with Jira (dry run first)

```bash
/pm-sync-jira
```

You'll see a dry-run report of what would happen. Review it.

## Step 9: Sync with Jira (apply)

When you're happy, confirm with Claude Code and the sync will push:

```
/pm-sync-jira
> apply
```

The script will:
- Create new Jira issues for files with `jira_key: null`
- Update existing Jira descriptions where the spec has drifted
- Write `jira_key`, `jira_sync_at`, `jira_sync_hash` back into the sidecar YAMLs

Commit the sidecar updates:

```bash
git add specs/
git commit -m "chore: sync Jira keys into spec sidecars"
```

## Next steps

- Install the GitHub Actions validation workflow (one-off manual step, see `docs/ci/README.md`)
- Add more ADRs as decisions happen
- Run `/pm-sync-jira` after any spec change to keep Jira in sync
- Use `/pm-validate` in a pre-commit hook (v0.2 will do this automatically)

## Common patterns

### Daily workflow

1. Pick up the next story from Jira
2. Open the spec file to read full context
3. Write failing tests from the acceptance criteria
4. Implement
5. Move the Jira ticket to "In Review" when your PR is open
6. Move to "Done" when merged
7. `/pm-sync-jira` pulls the status back into the sidecar YAML

### Adding a new strategic direction

1. `/pm-add-adr` to capture the decision
2. Reference the ADR from affected epics (add `[Source: decisions/NNNN.md]`)
3. `/pm-sync-jira` to push updated descriptions to Jira
4. Affected tickets get the new context automatically

### Mid-sprint scope change

1. Edit the story.md to reflect the change
2. `/pm-validate` to ensure it still passes
3. `/pm-sync-jira` to push the drift
4. The sync script's content hash detects the change and updates Jira
