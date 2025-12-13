# Story 3.1: Implement Project Lookup Mechanism

Status: done

## Story

As a User,
I want to ask "How is project X?" and have the system find the correct file,
So that I don't have to manually browse folders.

## Acceptance Criteria

1.  **Given** a query like "Status Vivo+",
2.  **When** the Oracle agent activates,
3.  **Then** it should search the `/data/Clients` directory for matching slugs/names.
4.  **And** it should read the content of the relevant `status.json`.

## Tasks / Subtasks

- [x] Task 1: Create Oracle Agent Rule
    - [x] Create `.agent/rules/freya/agents/oracle.mdc`.
    - [x] Define the primary responsibility: "Retrieval and Synthesis".
- [x] Task 2: Implement Search Logic
    - [x] Add instructions to search for projects using flexible matching (e.g., "Vivo" matches "vivo", "vivo-plus", "vivo-5g").
    - [x] Use `Glob` or `LS` tools to find the correct path.
    - [x] Handle "Project Not Found" gracefully.
- [x] Task 3: Connect Entry Point
    - [x] Update `.agent/rules/freya/index.mdc` to route "Oracle Query" (Option 2) to this new agent.

## Dev Notes

### Technical Requirements

*   **Fuzzy Matching:** As noted in the Epic 2 Retro, we need to handle slug inconsistencies. The agent should try to match user input against directory names case-insensitively.
*   **Recursive Search:** Project folders might be nested (e.g., `Clients/Vivo/5G`). The search should be recursive.
*   **Tool Usage:** Use `Glob` for searching.

## References

*   [Source: docs/epics.md#Story 3.1]
*   [Source: docs/sprint-artifacts/epic-2-retro-2025-12-12.md#Action Items]
