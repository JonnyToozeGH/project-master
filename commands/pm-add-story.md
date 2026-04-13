---
name: pm-add-story
description: Create a new story end-to-end - spec files, Jira ticket, test stubs, validation - in one flow.
---

# /pm-add-story

Create a new story with full traceability: spec files in git, Jira ticket nested under the epic, test stubs generated, sidecar wired, everything validated.

## What you should do

### 1. Identify the epic

Ask for the epic ID (e.g. `BILL-E01`) or let the user pick from a list of epics under `specs/`. Confirm the epic exists.

### 2. Gather story details

Ask for:
- **Title** - short human-readable
- **User story** - "As a X, I want Y, so that Z" (ask each piece or accept pre-composed)
- **Priority** - default inherits from epic
- **Owner** - default inherits from epic
- **Acceptance criteria** - in Given/When/Then format. Ask for at least 3. Each AC should have:
  - A title (e.g. "Retry logic added for failed payments")
  - A Given line
  - A When line
  - A Then line
- **Dev notes** - file paths likely to change, tech approach, code_refs
- **Dependencies** - on other stories (within this epic or cross-epic)

### 3. Compute the ID

- Scan the epic folder for existing `S<NN>.yaml` files and pick the next number.
- Story ID: `<EPIC_ID>-S<NN>` e.g. `BILL-E01-S03`.

### 4. Create the spec files

```
specs/<module>/<EPIC_FOLDER>/
  S<NN>-<slug>.md
  S<NN>.yaml
```

- **S<NN>-<slug>.md**: Use `${CLAUDE_PLUGIN_ROOT}/templates/story.md`. Fill in story ID, sidecar ref, epic backlink, module, priority, user story, all acceptance criteria, dev notes, dependencies, change log.
- **S<NN>.yaml**: Use `${CLAUDE_PLUGIN_ROOT}/templates/story.yaml`. Fill in id, type (`story`), title, priority, module, epic, owner, status (`backlog`), acceptance_criteria_count, code_refs, test_refs (`[]`), test_status (`missing`), coverage_target (100), dates.

### 5. Update the epic

- Add the story ID to the epic's `stories:` array in `epic.yaml`.
- Increment `stories_total`.
- Add a row to the Stories table in `epic.md`.

### 6. Create the Jira ticket

**Automatically create the Jira story under the parent epic.** Do not defer to `/pm-sync-jira`.

- Read Jira credentials from `.mcp.json` or environment variables.
- Look up the parent epic's `jira_key` from its `epic.yaml`.
- Create a Story in Jira with:
  - Summary: `[<STORY_ID>] <title>` (e.g. `[BILL-E01-S03] Dunning email retry`)
  - Description: the user story + acceptance criteria text
  - Parent: the epic's `jira_key`
  - Labels: `project-master-managed`, `module-<module>`
  - Component: the module name (capitalised)
- Write the returned `jira_key` back into `S<NN>.yaml`.
- Set `jira_sync_at` to today's date.

If Jira credentials are not available or the epic has no `jira_key`, skip and advise running `/pm-sync-jira`.

### 7. Generate test stubs

If the test stub generator script exists at `scripts/generate-test-stubs.mjs` (in the project or plugin), run it against the new story:

```bash
node scripts/generate-test-stubs.mjs specs/<module>/<epic-folder>/S<NN>-<slug>.md
```

This creates a failing test file at `tests/specs/<module>/<epic-id>/S<NN>.spec.ts` with one `it()` per AC.

If the generator doesn't exist yet, create the test stub file manually:
- Path: `tests/specs/<module>/<epic-id>/S<NN>.spec.ts`
- One `describe()` block: `describe('<STORY_ID>: <title>')`
- One `it()` per AC: `it('AC<N>: <title>')`
- Each `it()` contains the Given/When/Then as comments + `expect(true).toBe(false)`
- Commented-out import hints from the story's `code_refs`

After generating the test file:
- Update the sidecar's `test_refs` to point at the test file
- Update `test_status` to `failing`

### 8. Validate

Run the spec validator to confirm:
- The story and sidecar are well-formed
- The epic's story list matches the folder contents
- No duplicate IDs
- Cross-references resolve

### 9. Report and suggest next steps

Show the user:
- Spec files created (with paths)
- Jira ticket created (with key, link, and parent epic)
- Test stub created (with path and AC count)
- Validation result

Suggest:
- Implement the test stubs (red -> green)
- Fill in any remaining dev notes
- Start coding against the ACs

## Guardrails

- Never overwrite existing story files. Use the next available number.
- If the epic doesn't exist, stop and redirect to `/pm-add-epic`.
- If fewer than 3 ACs, warn but don't block.
- Never expose Jira API tokens.
- If Jira or test stub generation fails, warn but don't fail - spec files are the primary deliverable.
- The test stub file must never overwrite an existing test file (developer may have written real tests).
