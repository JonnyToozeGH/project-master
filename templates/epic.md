---
id: {{module_prefix}}-E{{epic_num}}
sidecar: epic.yaml
---

# Epic {{epic_num}}: {{title}}

**Module:** [{{module}}](../module.md)
**Priority:** P{{priority}}

## Vision

One paragraph describing what this epic delivers and why it matters. Written for a business reader.

## Scope

### In Scope
- {{item}}
- {{item}}

### Out of Scope
- {{item}}

## Functional Requirements

Each FR must be testable and cite its source.

- **FR-001:** The system MUST {{behaviour}}. [Source: {{ref}}]
- **FR-002:** The system MUST {{behaviour}}. [Source: {{ref}}]

## Non-Functional Requirements

- **NFR-001:** {{constraint}} (performance, security, compliance, usability)

## Success Criteria

Quantifiable. How will we know this epic is done and delivering value?

- **SC-001:** {{metric}} improves from {{baseline}} to {{target}} within {{timeframe}}
- **SC-002:** {{metric}}

## Stories

Stories are ordered by dependency. Use this list as the build sequence.

| Order | ID | Title | Status | Owner |
|-------|-----|-------|--------|-------|
| 1 | S01 | [{{story}}](./S01-{{slug}}.md) | backlog | {{owner}} |
| 2 | S02 | [{{story}}](./S02-{{slug}}.md) | backlog | {{owner}} |
| 3 | S03 | [{{story}}](./S03-{{slug}}.md) | backlog | {{owner}} |

## Architecture Notes

Key architectural decisions for this epic. Link to ADRs where applicable.

- See [ADR-{{n}}: {{title}}](../../../decisions/{{n}}-{{slug}}.md)

## Dependencies

- Requires: {{dependency}}
- Blocks: {{blocked_thing}}

## Open Questions

Tag unresolved items so they surface in grep:

- [NEEDS CLARIFICATION: {{question}}]

## Change Log

| Date | Change | By |
|------|--------|-----|
| YYYY-MM-DD | Created | {{author}} |
