# Story 9.1: Implement Health Check & Maintenance Command Integration

Status: Done

## Story

As a User,
I want to ask Freya to "Check system health" or "Verify data integrity",
So that she runs the `npm run health` script automatically and reports the results in the chat.

## Acceptance Criteria

1.  **Given** a user request like "Verifique a integridade", "Health check" or "Meus dados estão ok?",
2.  **When** the agent processes the request,
3.  **Then** it should execute the command `npm run health` (or `node scripts/validate-data.js`).
4.  **And** it should capture the output and summarize it for the user (e.g., "Tudo ok, 3 arquivos verificados" or "Erro encontrado em X").
5.  **And** updates to `master.mdc` routing are required to change "Suggest" to "Execute".

## Tasks / Subtasks

- [x] Update `master.mdc` routing logic to identify "Health Check" intents.
- [x] Configure the agent instruction to explicitly RUN the command `npm run health` when this intent is detected.
- [x] Verify that the agent reads the command output and presents it to the user.
- [x] (Optional) If an error is found, the agent should offer to help fix it (though auto-fix is a future story).

## Dev Notes

### Developer Context
The goal is to move from "Passive Advisory" to "Active Assistance". Currently, Freya suggests commands. Now, she will run them. This applies to safe, read-only commands like health checks.

### Technical Requirements
*   **Target File:** `.agent/rules/freya/agents/master.mdc`.
*   **Routing Logic:** Locate the `<routing-logic>` block.
*   **Change:**
    *   FROM: `Suggest running npm run health...`
    *   TO: `Execute npm run health via the Shell tool and report the results...`

### Architecture Compliance
*   **Agent Autonomy:** Agents are allowed to run shell commands if they are safe.
*   **Tool Usage:** The agent must be instructed to use the `Shell` tool (or equivalent available tool) to run the command.

### Previous Story Intelligence
*   **Epic 7:** `validate-data.js` was created. It outputs text to stdout.
*   **Pattern:** We have established that scripts in `scripts/` are the source of truth for logic.

### Security/Safety
*   **Command:** `npm run health` -> `node scripts/validate-data.js`.
*   **Risk:** Low. Read-only operation.
*   **Constraint:** Do NOT allow arbitrary command execution from user input. Hardcode the command in the rule.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `.agent/rules/freya/agents/master.mdc`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Refined routing logic requirements.
*   Added security constraint about hardcoded commands.

## Implementation Notes
- Updated `master.mdc` to explicitly command the execution of `npm run health`.
- Added constraints to report results directly to the user.
- Security consideration: Limited to specific command string.

## File List
- .agent/rules/freya/agents/master.mdc (Modified)

## Change Log
- 2025-12-13: Updated master agent routing for health check automation.

## Senior Developer Review (AI)
- **Date:** 2025-12-13
- **Reviewer:** Architect Agent
- **Outcome:** Approved
- **Summary:**
  - Routing logic updated correctly in `master.mdc`.
  - Constraint for using `Shell` tool is present.
  - Security consideration (no arbitrary commands) observed.
- **Action Items:** None
