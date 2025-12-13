# Story 6.3: Implement Task Retrieval (Radar)

Status: Done

## Story

As a User,
I want to ask "What do I have to do now?" or "Check my tasks",
so that I get a filtered list of `DO_NOW` tasks and stay focused on what matters.

## Acceptance Criteria

1.  **Intent Recognition:** The system (likely `oracle.mdc`) must recognize questions about "Tasks", "To-Dos", "Pendências".
2.  **Filtration Logic:**
    *   Query "O que tenho pra fazer?" -> Filter `category == DO_NOW` AND `status == PENDING`.
    *   Query "O que deleguei?" -> Filter `category == DELEGATE` AND `status == PENDING`.
    *   Query "Agenda?" -> Filter `category == SCHEDULE` AND `status == PENDING`.
3.  **Read Operation:** The agent must read `data/tasks/task-log.json` safely.
4.  **Response Format:** The output must be a clean markdown bullet list, including the Task ID (shortened) for easy reference.
    *   Example: `• [1a2b] Pagar boleto (High)`

## Tasks / Subtasks

- [x] Update `oracle.mdc` to include "Task Retrieval" capabilities/instructions.
- [x] Implement the read logic for `data/tasks/task-log.json` within the agent.
- [x] Add filtering logic to selecting tasks based on user query (DO_NOW vs DELEGATE vs SCHEDULE).
- [x] Define the output format prompt to ensure the response is concise and actionable.
- [x] Verify that `oracle.mdc` correctly retrieves tasks seeded in previous steps.

## Dev Notes

### Developer Context
This story focuses on the "Order Out" part of "Chaos In, Order Out" for tasks. The `oracle.mdc` agent is responsible for retrieval. It currently reads project status. Now it needs to also read `task-log.json`.

### Technical Requirements
*   **Target Agent:** `.agent/rules/freya/agents/oracle.mdc`.
*   **Source File:** `data/tasks/task-log.json`.
*   **Logic:**
    1.  Detect intent (Task Query).
    2.  Read JSON.
    3.  Filter in-memory (via LLM reasoning or tool).
    4.  Format response.

### Architecture Compliance
*   **Pattern:** Oracle Agent -> Read-Only access to `data/`.
*   **Performance:** `task-log.json` is expected to be small enough for full read by LLM context window for now.

### Previous Story Intelligence
*   **Story 6.2:** Implemented the *writing* of tasks. Now we implement *reading*.
*   **Data Availability:** We can assume `task-log.json` exists and is populated (from testing 6.2).

### Testing Requirements
*   **Manual Test:** Ask "O que tenho pra fazer hoje?" after manually adding a DO_NOW task.
*   **Validation:** Verify filtering works (asking for delegated tasks shouldn't show DO_NOW).

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `docs/sprint-artifacts/6-2-implement-task-ingestion.md`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Updated Acceptance Criteria to specify response format.
*   Assigned responsibility to `oracle.mdc`.

### Implementation Notes (2025-12-13)
*   Updated `oracle.mdc` to support `Task Query` intent and routing.
*   Implemented filtering logic for `DO_NOW`, `SCHEDULE`, `DELEGATE` categories.
*   Defined explicit response formatting for tasks.
*   Verified logic via `tests/unit/test-oracle-retrieval.js`.

### File List
*   .agent/rules/freya/agents/oracle.mdc
*   tests/unit/test-oracle-retrieval.js

### Change Log
*   2025-12-13: Implemented Task Retrieval logic in Oracle Agent.

## Senior Developer Review (AI)

**Date:** 2025-12-13
**Outcome:** Approved

### Findings
*   **AC Validation:** All ACs met. `oracle.mdc` updated with retrieval and filtering logic.
*   **Task Audit:** All tasks implemented. Logic verification test provided.
*   **Code Quality:** Good. Reads file directly and uses prompt for logic, fitting the architecture.

### Action Items
None.
