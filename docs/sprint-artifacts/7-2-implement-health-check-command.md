# Story 7.2: Implement Health Check Command

Status: Done

## Story

As a User,
I want to run a simple command to check system health,
So that I trust my data.

## Acceptance Criteria

1.  **Given** the validation script `scripts/validate-data.js` exists,
2.  **When** I run `npm run health`, **Then** it executes the validation script and reports results.
3.  **When** I ask Freya "Run Health Check" (via `sm` or `dev`), **Then** it should be able to execute this command or guide me to run it.
4.  **Package Management:** A `package.json` must exist to manage scripts, even if dependencies are zero.

## Tasks / Subtasks

- [x] Initialize `package.json` (if missing) with minimal config.
- [x] Add `scripts: { "health": "node scripts/validate-data.js" }` to `package.json`.
- [x] Verify `npm run health` works.
- [x] Update `master.mdc` (or relevant high-level agent rule) to include knowledge of this health check capability as a troubleshooting step.

## Dev Notes

### Developer Context
This story integrates the validation script (Story 7.1) into the project's standard tooling (`npm scripts`). This makes it discoverable and standardizes how we run maintenance tasks.

### Technical Requirements
*   **File:** `package.json`
*   **Script:** `npm run health` -> `node scripts/validate-data.js`
*   **Dependencies:** None required for runtime, but `package.json` is good practice.

### Architecture Compliance
*   **Standardization:** Using `npm run` is a standard JS pattern.
*   **Zero-Dep:** We can have `package.json` without dependencies.

### Previous Story Intelligence
*   **Story 7.1:** Created the script. Now we just wrap it.

### Testing Requirements
*   **Manual Test:** Run `npm run health` in the terminal.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `docs/sprint-artifacts/7-1-implement-validation-script.md`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Defined integration via `package.json`.
*   Added task to update agent rules for awareness.

## Implementation Notes
- Created `package.json` with `npm run health` script pointing to `scripts/validate-data.js`.
- Updated `.agent/rules/freya/agents/master.mdc` to include "System Health" capability in routing logic.
- Verified execution with `npm run health`.
- Added unit test `tests/unit/test-package-config.js` to validate `package.json` structure.

## File List
- package.json (New)
- .agent/rules/freya/agents/master.mdc (Modified)
- tests/unit/test-package-config.js (New)

## Change Log
- 2025-12-13: Initial implementation of Health Check command.

## Senior Developer Review (AI)

### Review Outcome
*   **Status:** Approved
*   **Date:** 2025-12-13
*   **Reviewer:** Architect Agent (Winston)

### Findings
*   **Integration:** `package.json` correctly maps the health script to the node command.
*   **Persona:** `master.mdc` update ensures the agent is aware of the new capability, bridging the gap between CLI tools and the chat interface.
*   **Testing:** New unit test `test-package-config.js` ensures the `package.json` integrity is maintained.

### Action Items
*   [x] None. Implementation meets all criteria.
