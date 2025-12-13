# Story 6.1: Define Task Schema

Status: done

## Senior Developer Review (AI)

### Review Outcome
*   **Outcome:** Approved
*   **Date:** 2025-12-13
*   **Reviewer:** Architect Agent

### Action Items
*   [ ] None (Clean implementation)

### Severity Breakdown
*   High: 0
*   Medium: 0
*   Low: 0

### Detailed Findings
1.  **AC Validation:** All ACs met. Schema defined, directory created, file initialized, fields documented.
2.  **Task Audit:** All tasks implemented verified via file inspection.
3.  **Code Quality:** JSON structure is valid. Test script `test-task-schema.js` correctly validates the initial state.
4.  **Documentation:** `data/schemas.md` updated correctly.

## Story

As a Developer,
I want to define the JSON structure for storing tasks (`DO_NOW`, `SCHEDULE`, `DELEGATE`, `IGNORE`),
so that the system has a consistent way to track and manage personal to-dos.

## Acceptance Criteria

1.  **Schema Definition:** The JSON schema for tasks must be defined and documented in `data/schemas.md`.
2.  **Directory Creation:** The `data/tasks/` directory must be created if it does not exist.
3.  **File Initialization:** An initial `data/tasks/task-log.json` file must be created with an empty entries array: `{ "tasks": [] }`.
4.  **Field Requirements:** The schema must support the following fields:
    *   `id` (string, UUID or timestamp-based slug)
    *   `description` (string)
    *   `category` (enum: "DO_NOW", "SCHEDULE", "DELEGATE", "IGNORE")
    *   `status` (enum: "PENDING", "COMPLETED", "ARCHIVED")
    *   `createdAt` (ISO 8601 date string)
    *   `completedAt` (ISO 8601 date string, optional)
    *   `projectSlug` (string, optional, for linking to projects)
    *   `priority` (string, optional: "high", "medium", "low")

## Tasks / Subtasks

- [x] Update `data/schemas.md` to include the new Task Log schema definition.
- [x] Create `data/tasks/` directory in the project root.
- [x] Implement initialization logic (or manual creation) for `data/tasks/task-log.json`.
- [x] Verify that the `task-log.json` allows for valid JSON content.

## Dev Notes

### Developer Context
This story establishes the foundational data structure for the "Personal Dashboard" feature. Unlike project logs (which are sharded by client/project), tasks are centralized in a single file (`task-log.json`) because they are personal and high-frequency. We are adopting a modified Eisenhower Matrix tagging system (`DO_NOW`, etc.) to help the user prioritize chaos.

### Technical Requirements
*   **File Path:** `data/tasks/task-log.json`.
*   **Format:** Standard JSON.
*   **Encoding:** UTF-8.
*   **Schema Location:** Document the schema in `data/schemas.md` (create this file if it doesn't exist, serving as a registry for all system schemas).

### Architecture Compliance
*   **Local-First:** All data stays in `data/`.
*   **Naming Conventions:**
    *   Directory: `kebab-case` (`data/tasks`).
    *   File: `kebab-case` (`task-log.json`).
    *   JSON Fields: `camelCase` (`createdAt`, `projectSlug`).
*   **Atomic Writes:** Although this story is just defining the schema, any future writer implementation must use atomic writes.

### Testing Requirements
*   **Manual Verification:** Check that `data/tasks/` exists and `task-log.json` contains valid JSON `{ "tasks": [] }`.
*   **Schema Validation:** Ensure `data/schemas.md` accurately reflects the structure created.

### References
*   [Architecture: Data Architecture](docs/architecture.md#data-architecture) - Definition of JSON formats and naming patterns.
*   [PRD: Functional Requirements](docs/prd.md#functional-requirements) - Context for task management (implied in "Chaos In, Order Out").

## Dev Agent Record

### Context Reference
*   Sources: `docs/architecture.md`, `docs/sprint-artifacts/6-1-define-task-schema.md` (original draft).

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Refined schema to use `camelCase` for fields (`created_at` -> `createdAt`) to match Architecture NFRs.
*   Added `priority` field as a likely future requirement.

### Implementation Notes (2025-12-13)
*   Updated `data/schemas.md` with the new Task Log schema including `priority` field.
*   Created `data/tasks/` directory and `task-log.json` initialized with empty array.
*   Created verification test `tests/unit/test-task-schema.js` to ensure JSON validity.
*   Verified compliance with camelCase field naming.

### File List
*   data/schemas.md
*   data/tasks/task-log.json
*   tests/unit/test-task-schema.js

### Change Log
*   2025-12-13: Implemented schema definition and file initialization. Added verification test.
