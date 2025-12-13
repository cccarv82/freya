# Story 8.1: Implement Weekly Report Generator

Status: Done

## Story

As a User,
I want a summary of my week's activities,
So that I can use it in my weekly meetings without manually digging through logs.

## Acceptance Criteria

1.  **Given** a week of logs and updates, **When** I ask "Gerar Resumo Semanal" (or "Generate Weekly Report"), **Then** Freya generates a Markdown report.
2.  **And** the report includes sections for:
    *   **Project Updates:** Summarized from `status.json` history entries in the last 7 days.
    *   **Completed Tasks:** From `task-log.json`, filtered by `completedAt` in range.
    *   **Career Achievements:** From `career-log.json`, filtered by date.
3.  **And** the report is saved to `docs/reports/weekly-YYYY-MM-DD.md` (or similar path) AND displayed in chat.
4.  **Zero-Dependency:** Logic must be implemented using standard Node.js libraries (`fs`, `path`).

## Tasks / Subtasks

- [x] Create `scripts/generate-weekly-report.js` (Zero-dep script).
- [x] Implement date filtering logic (Today - 7 days).
- [x] Implement data aggregation from `data/Clients/**/*.json` (Project History).
- [x] Implement data aggregation from `data/tasks/task-log.json` (Completed Tasks).
- [x] Implement data aggregation from `data/career/career-log.json` (Achievements).
- [x] Format output as Markdown string.
- [x] Teach `master.mdc` or `oracle.mdc` to trigger this script when asked for a weekly report.
- [x] Add unit test `tests/unit/test-report-generation.js` to simulate report creation with mock data.

## Dev Notes

### Developer Context
We are building the "Reporting Engine" for FREYA. Following the pattern from Epic 7, we will implement this as a standalone script first (`scripts/generate-weekly-report.js`) to ensure robustness and testability, and then expose it to the Agent Persona.

### Technical Requirements
*   **Language:** Node.js (CommonJS).
*   **Dependencies:** `fs`, `path` ONLY.
*   **Output:** Markdown file + Console output (for Agent capture).
*   **Path:** `docs/reports/` (Create if missing).

### Architecture Compliance
*   **Pattern:** Logic in `scripts/`, Data in `data/`, Interface via Agent Rules.
*   **Atomic Reads:** Read files safely using `fs`.

### Previous Story Intelligence
*   **Epic 7:** We successfully used `scripts/validate-data.js` for system health. This is a similar pattern: `scripts/generate-report.js`.
*   **Epic 6:** We have a robust `task-log.json` structure.
*   **Testing:** We must write a "Simulation Test" first (`tests/unit/test-report-generation.js`) to verify the aggregation logic without polluting real data.

### Testing Requirements
*   **Unit Test:** Mock the file system (or use temp files) to verify that the script correctly filters dates (ignores events > 7 days old) and formats the markdown.
*   **Manual Test:** Run the script against the current real data and verify the output.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `docs/sprint-artifacts/epic-7-retro-2025-12-13.md`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Drafted story with full context.
*   Incorporated "Simulation Testing" and "Zero-Dependency" learnings.

## Implementation Notes
- Created `scripts/generate-weekly-report.js` adhering to zero-dependency rules.
- Created `tests/unit/test-report-generation.js` simulating the logic before implementation.
- Updated `package.json` with `npm run report`.
- Updated `master.mdc` to handle "Reporting" intent.
- Verified generation with both mock data (tests) and real data (empty/old state).

## File List
- scripts/generate-weekly-report.js (New)
- tests/unit/test-report-generation.js (New)
- package.json (Modified)
- .agent/rules/freya/agents/master.mdc (Modified)

## Change Log
- 2025-12-13: Implemented weekly report generator logic and script.

## Senior Developer Review (AI)

**Reviewer:** Architect Agent (Winston)
**Date:** 2025-12-13
**Outcome:** Approved

### Findings
- **Implementation:** `scripts/generate-weekly-report.js` correctly implements the aggregation logic.
- **Zero-Dependency:** Strict adherence to `fs` and `path` modules observed.
- **Testing:** Unit tests provide good coverage of the filtering logic.
- **Integration:** Agent rules updated correctly.

### Action Items
- None. Code is solid and ready for use.
