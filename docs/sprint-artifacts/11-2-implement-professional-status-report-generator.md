# Story 11.2: Implement Professional Status Report Generator

Status: done

## Story

As a User,
I want to generate a "Professional Status Report" (Daily/Weekly) that aggregates Tasks, Project Updates, and Daily Logs into a structured executive summary,
So that I can send it to stakeholders without manual editing.

## Acceptance Criteria

1. **Given** data in `task-log.json`, `status.json` (projects), and `logs/daily/*.md`,
2. **When** I ask for "Gerar status report" (or "Daily Report", "Weekly Report"),
3. **Then** the system should aggregate:
    *   **Completed Tasks:** From `task-log.json` (filtered by period).
    *   **Project Progress:** From `status.json` history (all active projects).
    *   **Context/Notes:** Extract relevant summaries from `logs/daily` (filtered by period).
4. **And** it should format the output into sections:
    *   **Resumo Executivo** (High-level summary)
    *   **Principais Entregas** (Tasks completed)
    *   **Status dos Projetos** (Updates per project)
    *   **Pontos de Atenção/Bloqueios** (Blockers)
    *   **Próximos Passos** (Pending DO_NOW tasks)
5. **And** the output should be polished and professional (Markdown).

## Dev Notes

### Developer Context
The goal is to move beyond simple lists of tasks. The report needs to look like something a PM would send to a Director. It needs to cross-reference data sources.

### Technical Requirements
*   **New Script:** Create `scripts/generate-executive-report.js`.
*   **Parameters:** Accept a `--period` argument (`daily` or `weekly`) to filter dates.
*   **Data Aggregation:**
    *   **Tasks:** Read `data/tasks/task-log.json`. Filter `completedAt` (for delivered) and `status=PENDING` + `category=DO_NOW` (for next steps).
    *   **Projects:** Recursive scan of `data/Clients/**/*.json`. Read `history` array. Filter events within the period.
    *   **Logs:** Read `logs/daily/*.md`. Extract text blocks (optional advanced feature: simple concatenation for now, or regex extraction of "Blockers").
*   **Formatting:** Use a clean Markdown template.
*   **Integration:** Update `package.json` with `npm run status`. Update `master.mdc` to map "Relatório Status", "Status Report", "Daily Profissional" to this new command.

### Architecture Compliance
*   **Zero Dependencies:** Use standard Node.js (`fs`, `path`).
*   **Read-Only:** The script reads data files and writes a *new* report file to `docs/reports/`. It does NOT modify data files.

### Previous Story Intelligence
*   **Epic 8:** We already have basic `generate-daily-summary.js` and `generate-weekly-report.js`. This new script should likely *supersede* or *evolve* them. Recommendation: Make this the new standard "Report" tool.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Consider deprecating the old scripts if this one covers both use cases well.

## Implementation Details (2025-12-13)

### Changes
*   **Created `scripts/generate-executive-report.js`**:
    *   Implements data aggregation from Tasks, Projects, and Logs.
    *   Generates a structured Markdown executive report.
    *   Supports `--period daily` and `--period weekly`.
*   **Updated `package.json`**:
    *   Added `"status": "node scripts/generate-executive-report.js"`.
*   **Updated `master.mdc`**:
    *   Changed routing logic for reports to use the new `npm run status` command instead of the legacy scripts.

## Senior Developer Review (AI)

### Review Summary
**Date:** 2025-12-13
**Reviewer:** Architect Agent
**Status:** Approved

### Findings
1.  **Script Quality:** The `generate-executive-report.js` script is well-structured, modular, and handles missing files/directories gracefully (`try-catch` blocks).
2.  **Integration:** The npm script command and the `master.mdc` routing update ensure seamless integration with the chat interface.
3.  **Extensibility:** The script is designed to be easily extended (e.g., adding more sections or refining the "Daily" logic).
4.  **Zero Dependency:** Adhered strictly to the requirement of using only native Node.js modules.
