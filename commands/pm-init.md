---
name: pm-init
description: Initialise a ProjectMaster spec system in the current project. Creates the folder structure, README, constitution, and scaffolds an empty decisions/ folder.
---

# /pm-init

You're asked to initialise ProjectMaster in the user's current project. This sets up the canonical spec folder structure so the project can start authoring module/epic/story specs with full Jira integration.

## What you should do

1. **Verify current directory.** Confirm the user is in the project they want to initialise. If there's no git repo in the current directory, warn them. If a `specs/` or `decisions/` folder already exists, stop and ask whether to continue (they may already have ProjectMaster set up).

2. **Create the folder structure:**

```
./
├── README.md                 # Index and audience signposts
├── constitution.md           # Non-negotiable project principles
├── docs/                     # Human-facing documentation
│   ├── stakeholders/         # For business owners, investors
│   ├── developers/           # For the build team
│   ├── call-notes/           # Meeting notes
│   └── _source-documents/    # Raw inputs (optional)
├── architecture/             # System architecture (arc42 + C4)
│   └── diagrams/
├── decisions/                # Architecture Decision Records (MADR)
├── specs/                    # Canonical spec source (modules, epics, stories)
├── research/                 # Investigation docs
├── planning/                 # Sprint status roll-up
└── schemas/                  # JSON schemas (copied from the plugin)
```

Create directories with `mkdir -p` in a single Bash call. Don't create any `node_modules/` or source code - this is a spec-only scaffold.

3. **Copy the JSON schemas** from `${CLAUDE_PLUGIN_ROOT}/schemas/` into the project's `./schemas/` folder. This lets the validator work locally without needing the plugin installed (though installing it is still the recommended path).

4. **Write the initial README.md** pointing at the structure:

```markdown
# [Project Name] Specifications

Source of truth for what [project] is, what it does, and how it's built. This repo is spec-driven: code serves specs, not the other way around.

## Start here

- I'm a stakeholder -> docs/stakeholders/
- I'm a developer -> docs/developers/
- I want to know why decisions were made -> decisions/
- I want the architecture picture -> architecture/
- I want to see what we're building -> specs/

## Structure

... (copy from this command's explanation above)

## Managed by ProjectMaster

This repo uses ProjectMaster conventions for specs, validation, and Jira sync. See https://github.com/JonnyToozeGH/project-master for the full guide.
```

Ask the user for the project name if they haven't told you.

5. **Write a starter constitution.md** listing non-negotiable principles. Don't guess at their values - leave placeholders they can fill in, but seed with universal ones like "specs are the source of truth", "every story has acceptance criteria", "no deployment without explicit user confirmation", etc.

6. **Create a .pm-config.json** at project root with at least:

```json
{
  "project_name": "[name]",
  "modules": [],
  "jira": {
    "host": "",
    "project": ""
  }
}
```

The modules array is empty - they'll populate it as they define modules.

7. **Report back** with a summary of what was created, and suggest the next step: either `/pm-add-module` (once that command exists) or manually creating their first module using the templates at `${CLAUDE_PLUGIN_ROOT}/templates/`.

## Guardrails

- Never delete existing files. If something is in the way, ask what to do.
- Never overwrite an existing README.md or constitution.md without asking first.
- Never init in a directory that already has `specs/` unless the user confirms.
- This command does not create any Jira tickets. Jira sync happens separately via `/pm-sync-jira`.
