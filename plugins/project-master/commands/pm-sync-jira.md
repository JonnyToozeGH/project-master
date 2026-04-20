---
name: pm-sync-jira
description: Sync ProjectMaster spec sidecar YAMLs with a Jira project. Dry-run by default.
---

# /pm-sync-jira

Run the Jira sync script for the current project.

## What you should do

1. **Check env vars are set.** The sync script needs `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, and `JIRA_PROJECT`. If any are missing, guide the user through setting them. They can either:
   - Export them in their shell (temporary)
   - Add them to a `.env.local` file at project root (git-ignored)
   - Configure them via `.pm-config.json` (not yet implemented)

2. **Default to dry run.** Do NOT pass `--apply` unless the user explicitly says "push", "apply", "for real", or similar. Explain that dry-run shows what will happen, and they should review before running with `--apply`.

3. **Run the sync:**

```bash
CLAUDE_PLUGIN_ROOT=${CLAUDE_PLUGIN_ROOT} \
JIRA_HOST=$JIRA_HOST \
JIRA_EMAIL=$JIRA_EMAIL \
JIRA_API_TOKEN=$JIRA_API_TOKEN \
JIRA_PROJECT=$JIRA_PROJECT \
node ${CLAUDE_PLUGIN_ROOT}/scripts/sync-jira.mjs
```

Add `--apply` only on explicit confirmation.

4. **Summarise the result.** Report the counts: created, updated, unchanged, skipped, errors. If there were errors, show them verbatim.

5. **On successful apply, commit the sidecar changes.** The sync writes `jira_key`, `jira_sync_at`, and `jira_sync_hash` back to the sidecar YAMLs. Offer to stage and commit them as "chore: sync Jira keys into spec sidecars" unless the user wants to bundle them with something else.

## Principles to remind the user

- **Git is canonical for spec content.** If Jira and git disagree on what a story says, git wins.
- **Jira is canonical for status transitions.** Moving a ticket in Jira is what signals work has started.
- **One Jira ticket per spec file.** The `jira_key` in the sidecar is the permanent link.
- **Deletion is manual.** The script will never delete or close Jira issues.

## Guardrails

- Never run `--apply` without explicit confirmation (not just "go ahead" - you need a clear "yes push to Jira").
- If the user has a large number of changes (more than 20 creates), read them back and ask for confirmation before applying.
- Never expose the API token in any log or commit.
- If Jira returns 401/403, fail fast - don't retry with different credentials.

## Git preflight (built into the script since v0.1.2)

The script now refuses to run if the project root is a git repository and either:

- the working tree has uncommitted changes (exit code 3), or
- the current branch is behind its `origin/<branch>` remote (exit code 4).

This prevents two real failure modes that have happened in the wild:
1. Syncing a stale checkout creates duplicate Jira tickets because the
   script cannot see `jira_key`s that only exist on `origin`.
2. Syncing a dirty tree loses local-only changes when the next pull
   brings in a conflicting update.

If the script exits 3 or 4, fix the underlying git state (commit or stash,
pull) and re-run. Do NOT pass `--skip-git-check` unless the user explicitly
asks for it and understands the risk.

If the project root is not a git repo at all, the check is skipped silently.
