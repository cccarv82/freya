# Story 3.3: Implement Fact Citation (Anti-Hallucination)

Status: done

## Story

As a User,
I want to know WHEN an update was made,
So that I trust the data.

## Acceptance Criteria

1.  **Given** any factual claim in the response,
2.  **When** the response is generated,
3.  **Then** it must include the date of the source entry (e.g., "[Updated: 2023-10-27]").
4.  **And** if no data exists, it must explicitly say "I have no records for this project."

## Tasks / Subtasks

- [ ] Task 1: Add Citation Logic to Oracle
    - [ ] Update `.agent/rules/freya/agents/oracle.mdc`.
    - [ ] Instruct the agent to append `(Source: {filepath})` at the end of the response.
    - [ ] Ensure every bullet point in "Recent Updates" starts with the date `* **YYYY-MM-DD:** ...`.
- [ ] Task 2: Implement "No Data" Guardrail
    - [ ] If the glob search returns empty, return a specific error message defined in AC 4.

## Dev Notes

### Technical Requirements

*   **Transparency:** The user must be able to trace the information back to a file on their disk. This builds trust in the "Local-First" promise.

## References

*   [Source: docs/epics.md#Story 3.3]
*   [Source: docs/sprint-artifacts/epic-2-retro-2025-12-12.md#Commitments]
