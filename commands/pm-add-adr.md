---
name: pm-add-adr
description: Create a new Architecture Decision Record (ADR) in MADR format.
---

# /pm-add-adr

Create a new ADR for a project decision.

## What you should do

1. **Ask for the decision details:**
   - Title (what is being decided, short)
   - Context and problem statement (what motivated this)
   - Decision drivers (criteria / forces at play)
   - Considered options (at least 2, ideally 3+)
   - Chosen option and why
   - Consequences: good, bad, neutral
   - Related decisions (if any)

2. **Pick the next ADR number.** Look at `decisions/` for files matching `NNNN-*.md` and find the highest, then increment. Use 4-digit zero-padded numbers (e.g. `0022`).

3. **Create the file** `decisions/NNNN-kebab-case-title.md` from `${CLAUDE_PLUGIN_ROOT}/templates/adr.md`. Fill in:
   - `id: ADR-NNNN`
   - `type: adr`
   - `status: proposed` (or `accepted` if the user confirms the decision is final)
   - `date` (today)
   - `decision-makers` (ask)
   - `consulted` (ask)
   - `informed` (ask)
   - Title, context, drivers, options, outcome, consequences

4. **Update the decisions/README.md** index if one exists. Add a row to the appropriate category table. If there's no README, offer to create one.

5. **Report the new file** and suggest linking it from related specs (`[Source: decisions/NNNN-title.md]` citations in epic or story files).

## Guardrails

- ADRs are immutable once accepted. If the user is editing an accepted ADR, stop and suggest writing a new ADR that supersedes the old one instead.
- Never overwrite existing ADR files.
- Status must be one of: `proposed`, `accepted`, `deprecated`, `superseded`.
- If the decision affects an existing ADR, ask if it supersedes or deprecates it, and update both files accordingly.
