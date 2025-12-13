# Story 3.2: Implement Status Summarization

Status: done

## Story

As a User,
I want a concise summary of the latest events, not a raw dump of the JSON,
So that I can quickly catch up on context.

## Acceptance Criteria

1.  **Given** a JSON file with 50 historical entries,
2.  **When** the Oracle answers,
3.  **Then** it should prioritize the `currentStatus` and the last 3 `history` entries.
4.  **And** it should synthesize a natural language response (e.g., "The project is on track, last update was yesterday...").

## Tasks / Subtasks

- [ ] Task 1: Add Summarization Logic to Oracle
    - [ ] Update `.agent/rules/freya/agents/oracle.mdc` with instructions to parse the JSON content.
    - [ ] Define the response structure:
        *   **Context Summary:** One sentence.
        *   **Current Status:** From `currentStatus`.
        *   **Recent History:** Bullet points of last 3 items.
- [ ] Task 2: Handle "No Data" Scenarios
    - [ ] If history is empty, state "Project initialized but no updates yet."

## Dev Notes

### Technical Requirements

*   **Context Window Management:** Do NOT dump the entire JSON into the context if it's huge. The agent should be instructed to read only the relevant parts or the "tail" of the history if possible (though `read_file` reads all, we can instruct the LLM to focus on the end).
*   **Persona:** Maintain the "Senior Scrum Master Coach" tone.

## References

*   [Source: docs/epics.md#Story 3.2]
*   [Source: .agent/rules/freya/agents/master.mdc#Communication]
