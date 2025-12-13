# Story 6.2: Implement Task Ingestion

Status: Done

## Story

As a User,
I want to register new tasks using natural language in the chat,
so that I don't have to open a spreadsheet to log "pay the bills" or "call client X".

## Acceptance Criteria

1.  **Intent Recognition:** The `ingestor.mdc` agent must recognize inputs that are tasks (e.g., starts with "Lembre-me", "Tarefa", "ToDo" or contains clear action items).
2.  **Entity Extraction:** The system must extract the `description` and infer the `category` (`DO_NOW`, `SCHEDULE`, `DELEGATE`, `IGNORE`) from the text.
    *   Default category: `DO_NOW` if urgency is detected or unspecified.
    *   Keywords mapping: "Agendar" -> `SCHEDULE`, "Delegar" -> `DELEGATE`, "Ignorar" -> `IGNORE`, "Fazer Agora" -> `DO_NOW`.
3.  **Persistence:** The task must be appended to the `tasks` array in `data/tasks/task-log.json` with a generated UUID, `createdAt` timestamp, and `status: "PENDING"`.
4.  **User Feedback:** The system must confirm the action with a message like: "Tarefa '{description}' salva em [{category}]."

## Tasks / Subtasks

- [x] Update `ingestor.mdc` prompt to include "Task" as a supported domain/intent.
- [x] Implement entity extraction logic in `ingestor.mdc` to parse task description and category.
- [x] Create a helper/tool or update `ingestor.mdc` logic to handle reading/writing to `data/tasks/task-log.json`.
- [x] Implement the atomic write operation to append the new task to the JSON file.
- [x] Verify that the `ingestor.mdc` correctly identifies and processes a sample task input.

## Dev Notes

### Developer Context
This story extends the "Universal Ingestion" capability (Epic 2) to handle Personal Tasks. The `ingestor.mdc` is the entry point. It needs to become smarter to distinguish between a "Project Update" and a "Personal Task".

### Technical Requirements
*   **Target File:** `data/tasks/task-log.json`.
*   **Agent to Modify:** `.agent/rules/freya/agents/ingestor.mdc` (or wherever the main ingestor logic resides).
*   **Logic:**
    1.  Detect Intent: Is this a task?
    2.  Extract: Description, Category (Infer/Map), Priority (Optional).
    3.  Load `task-log.json`.
    4.  Append new object to `tasks` array.
    5.  Save file (Atomic write recommended).
*   **UUID Generation:** Use a simple random string or timestamp-based ID generator if a UUID library isn't available in the agent's context (Agents usually generate IDs via LLM or simple scripts).

### Architecture Compliance
*   **Pattern:** Ingestor Agent -> Local JSON.
*   **Schema:** Must match `data/schemas.md` Task Log schema (defined in Story 6.1).
*   **User Experience:** "Chaos In" - accept "Lembre-me de x" without rigid syntax.

### Previous Story Intelligence
*   **Story 6.1:** Established the schema and file existence. You can rely on `data/tasks/task-log.json` existing.

### Testing Requirements
*   **Manual Test:** Simulate user input: "Lembre-me de enviar o email para o João (Agendar)".
*   **Validation:** Check `data/tasks/task-log.json` content after ingestion.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `docs/sprint-artifacts/6-1-define-task-schema.md`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Updated Acceptance Criteria to be more specific about Keywords Mapping.
*   Added specific tasks for modifying `ingestor.mdc`.

### Implementation Notes (2025-12-13)
*   Updated `ingestor.mdc` to support `Task` domain, entity extraction for categories, and persistence logic for `task-log.json`.
*   Verified file write operations with `tests/integration/test-ingestor-task.js`.

### File List
*   .agent/rules/freya/agents/ingestor.mdc
*   tests/integration/test-ingestor-task.js

### Change Log
*   2025-12-13: Implemented Task Ingestion logic in Ingestor Agent.

## Senior Developer Review (AI)

**Date:** 2025-12-13
**Outcome:** Approved

### Findings
*   **AC Validation:** All ACs met. `ingestor.mdc` prompt updated correctly with new intent and extraction logic.
*   **Task Audit:** All tasks implemented. Test script provided.
*   **Code Quality:** Implementation relies on prompt instructions (MDC), which is the architectural pattern for this project. Logic seems robust.

### Action Items
None.
