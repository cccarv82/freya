# Story 9.2: Implement Reporting Command Integration (Weekly & Daily)

Status: Done

## Story

As a User,
I want to ask Freya to "Generate Weekly Report" or "Daily Summary",
So that she runs the corresponding npm scripts and shows me the output/location immediately.

## Acceptance Criteria

1.  **Given** a user request like "Gerar relatório semanal" or "Weekly report",
2.  **When** the agent processes the request,
3.  **Then** it should execute `npm run report`.
4.  **And** inform the user where the file was saved (and potentially read/show the content).
5.  **Given** a user request like "Gerar daily" or "Resumo diário",
6.  **When** the agent processes the request,
7.  **Then** it should execute `npm run daily`.
8.  **And** display the output (Ontem/Hoje/Bloqueios) directly in the chat.

## Tasks / Subtasks

- [x] Update `master.mdc` routing logic to identify "Weekly Report" and "Daily Summary" intents.
- [x] Configure agent to execute `npm run report` for weekly requests.
- [x] Configure agent to execute `npm run daily` for daily requests.
- [x] Ensure the "Daily" output is formatted nicely in the chat response.

## Dev Notes

### Developer Context
Similar to Story 9.1, we are empowering the agent to run commands.
*   `npm run report` -> Creates file AND outputs summary to stdout.
*   `npm run daily` -> Outputs text to stdout.

### Technical Requirements
*   **Target File:** `.agent/rules/freya/agents/master.mdc`.
*   **Routing Logic Update:**
    *   Change "Suggest running..." to "Execute...".
    *   For "Weekly": Execute `npm run report`, read the output (which contains the file path), and confirm success to user.
    *   For "Daily": Execute `npm run daily` and echo the output verbatim.

### Architecture Compliance
*   **Agent Autonomy:** Authorized for safe reporting scripts.
*   **Persona:** Freya remains helpful and proactive. "Here is your report" is better than "You should run this command".

### Previous Story Intelligence
*   **Story 9.1:** Successfully implemented `npm run health` integration. Follow the same pattern.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `.agent/rules/freya/agents/master.mdc`, `docs/sprint-artifacts/9-1-implement-health-check-command-integration.md`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Drafted with clear parallel to Story 9.1.
*   Specified handling of stdout for both cases.

## Implementation Notes
- Updated `master.mdc` to explicitly command the execution of reporting scripts.
- Added specific instructions for handling Weekly vs. Daily outputs.

## File List
- .agent/rules/freya/agents/master.mdc (Modified)

## Change Log
- 2025-12-13: Updated master agent routing for reporting automation.

## Senior Developer Review (AI)
- **Date:** 2025-12-13
- **Reviewer:** Architect Agent
- **Outcome:** Approved
- **Summary:**
  - Routing logic updated correctly in `master.mdc` for both Weekly and Daily reports.
  - Instructions to use `Shell` tool and handle stdout are clear.
  - Output handling (read vs echo) is correctly specified.
- **Action Items:** None
