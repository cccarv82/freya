# Story 7.1: Implement Validation Script

Status: Done

## Story

As a Maintainer,
I want a Node.js script that validates all data files against the schemas,
So that I can detect corruption or format errors automatically.

## Acceptance Criteria

1.  **Given** the `data/` directory, **When** `node scripts/validate-data.js` is run, **Then** it should parse every `.json` file recursively.
2.  **And** if a file violates `schemas.md` rules (missing fields, wrong types), it must log an error with the file path and specific issue.
3.  **And** if all files are valid, it logs "✅ All systems operational".
4.  **Schema Coverage:** Must validate `data/tasks/task-log.json`, `data/career/career-log.json`, and `data/Clients/**/*.json`.

## Tasks / Subtasks

- [x] Create `scripts/` directory if it doesn't exist.
- [x] Create `scripts/validate-data.js`.
- [x] Implement recursive file walker to find all `.json` files in `data/`.
- [x] Implement validation logic for `Task Log` schema.
- [x] Implement validation logic for `Career Log` schema.
- [x] Implement validation logic for `Project Status` schema.
- [x] Add summary reporting (Total files, Errors found).

## Dev Notes

### Developer Context
This script acts as the "Doctor" for the FREYA system. Since we are using local-first JSON persistence without a database engine to enforce constraints, this script is our safety net. Ideally, it should be run periodically or via a pre-commit hook (if we had git hooks).

### Technical Requirements
*   **Runtime:** Node.js (Standard library only preferred, no heavy `npm install` unless necessary).
*   **Path:** `scripts/validate-data.js`
*   **Validation Strategy:**
    *   **Loose Validation:** Check for existence of critical fields (`id`, `status` in tasks; `currentStatus`, `history` in projects).
    *   **Type Checking:** Ensure arrays are arrays, dates look like ISO strings.
    *   **No Zod/Ajv:** Keep it lightweight. Write simple helper functions `validateTask(obj)`, `validateProject(obj)`.

### Architecture Compliance
*   **Pattern:** Maintenance Script.
*   **Location:** `scripts/`.
*   **Dependencies:** None (fs, path).

### Previous Story Intelligence
*   **Epic 6:** Created `task-log.json` structure.
*   **Epic 2/4:** Created `status.json` and `career-log.json` structures.
*   **Schemas:** Defined in `data/schemas.md` (implied source of truth).

### Testing Requirements
*   **Manual Test:** Run the script against current valid data.
*   **Negative Test:** Manually corrupt a JSON file (e.g., delete a required field) and verify the script reports it.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `docs/architecture.md`, `data/schemas.md` (implied).

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Expanded ACs to cover all data types.
*   Defined "Zero-Dep" strategy for validation logic.

### Implementation Notes (2025-12-13)
*   Created `scripts/validate-data.js` with zero external dependencies.
*   Implemented recursive walker and specific validators for Task Log, Career Log, and Project Status.
*   Verified against existing data (Pass) and manually corrupted data (Fail).

### File List
*   scripts/validate-data.js

### Change Log
*   2025-12-13: Added data validation script.

## Senior Developer Review (AI)

### Review Outcome
*   **Status:** Approved
*   **Date:** 2025-12-13
*   **Reviewer:** Architect Agent (Winston)

### Findings
*   **Compliance:** Implementation strictly adheres to "Zero-Dependency" rule, using only native `fs` and `path` modules.
*   **Completeness:** All schemas (Tasks, Career, Project Status) are covered by specific validation logic.
*   **Robustness:** Recursive walker correctly handles deep directory structures as required by `data/Clients/...`.
*   **Validation:** Error reporting is clear and concise.

### Action Items
*   [x] None. Code is solid and ready for use.
