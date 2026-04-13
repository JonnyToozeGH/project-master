---
name: pm-add-epic
description: Create a new epic end-to-end - spec files, Jira ticket, validation - in one flow.
---

# /pm-add-epic

Create a new epic with full traceability: spec files in git, Jira ticket created, everything validated.

## What you should do

### 1. Gather epic details

Ask the user for:
- **Module** - show existing modules under `specs/` as options. If only one exists, default to it.
- **Title** - short human-readable name
- **Vision** - one paragraph: what does this epic deliver and why does it matter
- **Priority** - P1, P2, P3
- **Owner** - who is responsible
- **Status** - default `backlog`
- **Dependencies** - any existing epic IDs this depends on
- **Blocks** - any existing epic IDs this blocks

### 2. Compute the ID

- Pick the next epic number for the module. Scan `specs/<module>/` for existing folders (e.g. `BILL-E01-*`, `BILL-E02-*`) and use the next number.
- Generate the module prefix: first 3-5 chars uppercase (e.g. `billing` -> `BILL`, `onboarding` -> `ONB`, `cross-cutting` -> `XCUT` where XCUT is the conventional prefix for the cross-cutting container). Confirm with user.
- The epic ID is `<PREFIX>-E<NN>` e.g. `BILL-E04`.

### 3. Create the spec files

Create the folder and files:

```
specs/<module>/<PREFIX>-E<NN>-<slug>/
  epic.md
  epic.yaml
```

- **epic.md**: Use the template at `${CLAUDE_PLUGIN_ROOT}/templates/epic.md`. Fill in ID, title, module, priority, vision. Leave detailed sections (Scope, FRs, NFRs, Stories) with headers for the user to fill in.
- **epic.yaml**: Use `${CLAUDE_PLUGIN_ROOT}/templates/epic.yaml`. Set id, type (`epic`), title, priority, module, owner, status, created/updated dates. Set `stories: []`, `depends-on`, `blocks`, and `jira_key: null`.

### 4. Create the Jira ticket

**Automatically create the Jira epic.** Do not defer to `/pm-sync-jira`.

- Read Jira credentials from the project's `.mcp.json` (look for any server entry whose name starts with `jira`), or from environment variables `JIRA_HOST`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_PROJECT`.
- Create an Epic in Jira with:
  - Summary: `[<EPIC_ID>] <title>` (e.g. `[BILL-E04] Dunning workflow`)
  - Description: the vision text
  - Labels: `project-master-managed`, `module-<module>`
  - Component: the module name (capitalised)
- Write the returned `jira_key` back into `epic.yaml`.
- Set `jira_sync_at` to today's date.

If Jira credentials are not available, skip this step and tell the user to run `/pm-sync-jira` later. Do not fail the whole flow.

### 5. Validate

Run the spec validator (`node ${CLAUDE_PLUGIN_ROOT}/scripts/validate-specs.mjs` or the project-local copy) to confirm the new epic is well-formed.

### 6. Report and suggest next steps

Show the user:
- Files created (with paths)
- Jira ticket created (with key and link)
- Validation result

Suggest:
- Add stories: `/pm-add-story`
- Fill in the Vision/Scope/FR/NFR sections in `epic.md`
- If Jira was skipped: run `/pm-sync-jira`

## Guardrails

- Never overwrite an existing epic folder. If the computed folder exists, pick the next number.
- Always confirm the module prefix with the user before using.
- If the module folder doesn't exist, offer to create it.
- Never expose Jira API tokens in output.
- If Jira creation fails, warn but don't fail - the spec files are the primary deliverable.
