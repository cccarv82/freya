# Story 10.1: Implement Auto-Commit Command

Status: Done

## Story

As a User,
I want to ask Freya to "Generate a commit" or "Save my changes",
So that she automatically stages files, generates a friendly commit message, and commits the changes without me needing to use the terminal.

## Acceptance Criteria

1. **Given** a user request like "Gere um commit", "Salvar alterações" or "Commitar",
2. **When** the agent processes the request,
3. **Then** it should execute `git status` to check for changes.
4. **And** if there are changes, it should execute `git diff` to understand what changed.
5. **And** it should generate a concise, friendly commit message describing the changes.
6. **And** it should execute `git add .` and `git commit -m "message"`.
7. **And** it should confirm the commit to the user.

## Tasks / Subtasks

- [x] Update `master.mdc` routing logic to identify "Commit" intents.
- [x] Implement the logic to execute `git status`, `git diff`, `git add`, `git commit` via the `Shell` tool.
- [x] Ensure the commit message is generated dynamically based on the diff.

## Dev Notes

### Developer Context
We are extending the "Agent-Script Integration" concept (Epic 9) to system commands.
The agent (Master) will need to be smart about handling multi-step processes via the Shell tool.
*   Unlike `npm run health` which is a single command, this is a sequence: `status` -> `diff` -> `think` -> `add` -> `commit`.
*   We need to ensure the agent doesn't hallucinate the commit message. It must be based on the diff.

### Technical Requirements
*   **Target File:** `.agent/rules/freya/agents/master.mdc`.
*   **Routing Logic Update:**
    *   Identify intent: "Commit", "Save changes".
    *   Instruction:
        1.  Check status: `git status --porcelain`.
        2.  If empty, reply "No changes to commit".
        3.  If not empty, run `git diff` (and `git diff --cached` if needed).
        4.  Analyze the diff output.
        5.  Construct a commit message following the format: "feat/fix/docs: summary".
        6.  Run `git add .`
        7.  Run `git commit -m "message"`.
        8.  Report back: "Commit generated: [message]".

### Architecture Compliance
*   **Agent Autonomy:** Authorized for git operations.
*   **Persona:** Freya remains helpful. "I've saved your changes with the message: X".
*   **Tool Usage:** Use `Shell` tool.

### Previous Story Intelligence
*   **Epic 9:** We successfully used `Shell` tool for `npm` scripts. The pattern is solid.
*   **Safety:** `git add .` is generally safe in a local dev environment, but we should be aware it stages everything.

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `.agent/rules/freya/agents/master.mdc`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Defined multi-step logic for the agent.
*   Emphasis on generating the message *dynamically* based on the diff.

## Implementation Notes
- Updated `master.mdc` with explicit instructions for the multi-step commit process.
- Added logic to handle empty status check to avoid empty commits.
- Enforced dynamic commit message generation based on diff analysis.

## File List
- .agent/rules/freya/agents/master.mdc (Modified)

## Change Log
- 2025-12-13: Added Git Operations routing logic to master agent.

## Senior Developer Review (AI)
- **Date:** 2025-12-13
- **Reviewer:** Architect Agent
- **Outcome:** Approved
- **Summary:**
  - Routing logic in `master.mdc` correctly implements the multi-step git workflow.
  - Checks for `git status` before committing prevent errors.
  - Instructions to use `git diff` for message generation ensure meaningful history.
  - Use of `Shell` tool is compliant with architecture.
- **Action Items:** None
