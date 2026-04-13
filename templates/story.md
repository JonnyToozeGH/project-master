---
id: {{module_prefix}}-{{epic_id}}-S{{story_num}}
sidecar: S{{story_num}}.yaml
---

# Story {{story_num}}: {{title}}

**Epic:** [{{epic_id}} - {{epic_title}}](../epic.md)
**Module:** {{module}}
**Priority:** P{{priority}}

## User Story

**As a** {{user_role}}
**I want** {{capability}}
**So that** {{value}}

## Acceptance Criteria

Each AC must be testable. Use Given/When/Then format. Number them so tests can reference them.

### AC1: {{short_title}}
**Given** {{precondition}}
**When** {{action}}
**Then** {{expected_result}}

### AC2: {{short_title}}
**Given** {{precondition}}
**When** {{action}}
**Then** {{expected_result}}

## Dev Notes

### Source Tree
Where this story's code lives:
- `apps/{{app}}/...`
- `packages/{{package}}/...`

### Dependencies
- Requires story: {{dependency_story_id}}
- Depends on ADR: [ADR-{{n}}](../../../decisions/{{n}}-{{title}}.md)

### References
All technical claims must cite source:
- [Source: architecture/c4-containers.md#{{section}}]
- [Source: decisions/{{adr}}.md]
- [Source: research/{{research}}.md]

### Testing Standards
- E2E test location: `{{path}}/{{story_id}}.e2e.spec.ts`
- Unit test location: `{{path}}/{{story_id}}.test.ts`
- Each AC must map to at least one test assertion

## Implementation Checklist

Tasks to complete this story. Each task should be small (< 1 day). Bind tasks to AC numbers.

- [ ] T1: {{task}} (AC1)
- [ ] T2: {{task}} (AC1, AC2)
- [ ] T3: {{task}} (AC2)
- [ ] T4: Write E2E test for AC1
- [ ] T5: Write E2E test for AC2
- [ ] T6: Verify all ACs pass

## Open Questions

Tag unresolved items with `[NEEDS CLARIFICATION]` so they become a searchable work queue:

- [NEEDS CLARIFICATION: {{question}}]

## Change Log

| Date | Change | By |
|------|--------|-----|
| YYYY-MM-DD | Created | {{author}} |
