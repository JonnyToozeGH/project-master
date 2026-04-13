---
id: {{module_prefix}}
sidecar: module.yaml
---

# {{module_name}}

**Status:** {{status}}
**Product Owner:** {{owner}}

## Vision

One paragraph describing what this module is and what it does for users. Written for a business reader.

## Product Definition

What is this module and what problem does it solve?

## Users

Who uses this module?

- **Primary:** {{persona}}
- **Secondary:** {{persona}}

## Core Capabilities

What can users do with this module at MVP?

1. {{capability}}
2. {{capability}}
3. {{capability}}

## What This Module Is Not

Explicit scope exclusions to prevent scope creep.

- Not {{thing}}
- Not {{thing}}

## Epics

Epics in build order. Link to each epic folder.

| Order | ID | Title | Status | Target |
|-------|-----|-------|--------|--------|
| 1 | [E01]({{module_prefix}}-E01-{{slug}}/epic.md) | {{title}} | in-progress | {{date}} |
| 2 | [E02]({{module_prefix}}-E02-{{slug}}/epic.md) | {{title}} | backlog | {{date}} |

## Cross-Module Dependencies

What this module relies on from other modules:

- {{module}}: {{what}}

## Data Model

Key entities owned by this module:

- {{entity}}: {{description}}

## Architecture

- Main service: {{service_name}}
- API: {{api_path}}
- Database tables: {{tables}}
- External integrations: {{integrations}}

See [architecture/c4-containers.md](../../architecture/c4-containers.md) for the full picture.

## Open Questions

- [NEEDS CLARIFICATION: {{question}}]

## References

- [Module product definition](../../docs/_source-documents/{{source_doc}}.md)
- [Relevant ADRs]

## Change Log

| Date | Change | By |
|------|--------|-----|
| YYYY-MM-DD | Created | {{author}} |
