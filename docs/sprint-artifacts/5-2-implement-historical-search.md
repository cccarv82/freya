# Story 5.2: Implement Historical Search

Status: done

## Story

As a User,
I want to be able to search for "Archived" projects if I need to retrieve an old decision,
So that the knowledge isn't lost forever.

## Acceptance Criteria

1.  **Given** a query explicitly asking for old projects (e.g., "O que fizemos no projeto X ano passado?"),
2.  **When** the Oracle searches,
3.  **Then** it should include files marked as `active: false`.
4.  **And** the response should indicate "[Archived Project]" clearly.

## Tasks / Subtasks

- [ ] Task 1: Update Oracle Rule (`oracle.mdc`) - Search Logic
    - [ ] Modify the logic to bypass the `active: false` filter if specific keywords are present.
    - [ ] Keywords: "historico", "history", "antigo", "arquivo", "archived", "old".
- [ ] Task 2: Update Oracle Rule (`oracle.mdc`) - Presentation
    - [ ] If a project is archived, prefix the response Context with `[ARCHIVED]`.
    - [ ] Ensure the `active` flag is checked *after* reading the file but *before* deciding to ignore it.
- [ ] Task 3: Test Scenario
    - [ ] Use `tests/archival_test.md` (created in Story 5.1).
    - [ ] Run Scenario 3 (Search Archived).
    - [ ] Verify the output explicitly mentions the archived status.

## Dev Notes

### Technical Requirements

*   **Prompt Engineering:** This is largely about refining the prompt logic in `oracle.mdc`.
*   **Performance:** No major performance impact expected as `Glob` finds files anyway; we are just changing the filtering condition in the LLM's "mind" (rule set).

## References

*   [Source: docs/epics.md#Story 5.2]
*   [Source: docs/sprint-artifacts/5-1-implement-project-archiving.md]
