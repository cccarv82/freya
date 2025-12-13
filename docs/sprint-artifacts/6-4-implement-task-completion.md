# Story 6.4: Implement Task Completion

Status: Done

## Story

As a User,
I want to mark tasks as done via chat (e.g., "Marcar tarefa X como feita"),
so that my list stays clean, updated, and reflects my progress.

## Acceptance Criteria

1.  **Intent Recognition:** The system (`ingestor.mdc` or specialized handler) must recognize "Completion" intents.
    *   Examples: "Terminei a tarefa X", "Check no item Y", "Marcar Z como feito", "Complete task ID".
2.  **Matching Logic:**
    *   **By ID:** If a short ID (e.g., "1a2b") is provided, match exactly.
    *   **By Description:** If text is provided (e.g., "Pagar boleto"), perform a fuzzy match or exact substring match.
    *   **Ambiguity Handling:** If multiple pending tasks match the description, ask the user to clarify (or list candidates).
3.  **Update Operation:**
    *   Locate the task in `data/tasks/task-log.json`.
    *   Update `status` to `COMPLETED`.
    *   Set `completedAt` to the current timestamp.
4.  **Feedback:** Confirm to the user that the task was marked as done.
    *   Example: "✅ Tarefa '[1a2b] Pagar boleto' marcada como concluída."

## Tasks / Subtasks

- [x] Update `ingestor.mdc` (or relevant agent) to detect "Task Completion" intent.
- [x] Implement logic to read `task-log.json`, find the target task (by ID or text), and update it.
- [x] Handle "Task Not Found" or "Ambiguous Match" scenarios gracefully.
- [x] Ensure the file write is atomic/safe (read-modify-write).
- [x] Verify that completed tasks no longer appear in "DO_NOW" queries (from Story 6.3).

## Dev Notes

### Developer Context
This story closes the loop on Task Management. We have Ingestion (Story 6.2) and Retrieval (Story 6.3). Now we need Update (Completion).
The `ingestor.mdc` agent is the natural place for *write* operations, even updates. However, complex "search then update" logic might require a collaborative flow or a smarter `ingestor`.
*Decision:* Let's keep write logic in `ingestor.mdc` to maintain the "Writer" responsibility separation, or give `ingestor` the ability to "search to update".

### Technical Requirements
*   **Target Agent:** `.agent/rules/freya/agents/ingestor.mdc`.
*   **Data Source:** `data/tasks/task-log.json`.
*   **Algorithm:**
    1.  Parse input for "Task Identifier" (ID or Description).
    2.  Load `task-log.json`.
    3.  Find index of task where `status == 'PENDING'` AND (`id == input` OR `description contains input`).
    4.  If 0 matches: Return "Not found".
    5.  If > 1 matches: Return "Ambiguous, please specify ID".
    6.  If 1 match: Update object, Save file, Confirm.

### Architecture Compliance
*   **Pattern:** Read-Modify-Write (Atomic).
*   **Schema:** Adhere to `data/schemas.md`.
*   **Efficiency:** Avoid rewriting the whole file if it gets huge (though for JSON, we usually rewrite the whole content).

### Previous Story Intelligence
*   **Story 6.2:** Established `task-log.json` structure.
*   **Story 6.3:** Established how to filter/read.
*   **Lesson:** ID-based references (introduced in 6.3 output) make completion much easier. The user should be encouraged to use IDs if possible, but natural language support is mandatory.

### Testing Requirements
*   **Unit Test:** Create a test script `tests/unit/test-task-completion.js` that seeds a task, calls the update logic, and verifies `status` became `COMPLETED`.
*   **Edge Case:** Try to complete a task that doesn't exist.
*   **Edge Case:** Try to complete a task that is already completed.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `docs/sprint-artifacts/6-2-implement-task-ingestion.md`, `docs/sprint-artifacts/6-3-implement-task-retrieval.md`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Updated `ingestor.mdc` to handle "Complete" action for Tasks.
*   Implemented ID and fuzzy description matching logic in the prompt instructions.
*   Verified logic via `tests/unit/test-task-completion.js`.

### File List
*   .agent/rules/freya/agents/ingestor.mdc
*   tests/unit/test-task-completion.js

### Change Log
*   2025-12-13: Added Task Completion logic to Ingestor Agent.

## Senior Developer Review (AI)

**Date:** 2025-12-13
**Outcome:** Approved

### Findings
*   **AC Validation:** All ACs met. `ingestor.mdc` handles update/completion logic via "Complete" action.
*   **Task Audit:** All tasks implemented.
*   **Code Quality:** Robust ambiguity handling logic defined in prompt. Matches architecture.

### Action Items
None.
