# Story 1.2: Implement Entry Point & Router (@freya)

Status: done

## Story

As a User,
I want to invoke `@freya` in the chat and see a menu of options,
So that I know how to interact with the system.

## Acceptance Criteria

1.  **Given** the user types `@freya` or `@freya help`, **When** the agent processes the input, **Then** it should display a menu with options: "Ingest Log", "Oracle Query", "Career Coach".
2.  **And** it should respond using the defined communication style (Pragmatic/Direct).
3.  **And** the `index.mdc` file should be created at `.agent/rules/freya/index.mdc`.
4.  **And** the agent must use the correct persona instructions from `master.mdc` (which also needs to be created or referenced). *Correction:* This story implies creating the main router logic.

## Tasks / Subtasks

- [x] Task 1: Create Master Agent Persona
    - [x] Create `.agent/rules/freya/agents/master.mdc`
    - [x] Define the "Senior Scrum Master Coach" persona details (Tone, Style, Principles).
    - [x] Include the routing logic (interpreting user intent).
- [x] Task 2: Create Entry Point (Router)
    - [x] Create `.agent/rules/freya/index.mdc`
    - [x] Define the `@freya` trigger.
    - [x] Implement the menu display logic (ASCII/Markdown menu).
    - [x] Configure the handoff logic to other agents (Ingestor, Oracle, Coach) - even if they are just placeholders for now.

## Dev Notes

### Technical Requirements

*   **Markdown Rules Engine:** Use the `.mdc` format compatible with Cursor/BMAD.
*   **Routing Logic:** The `index.mdc` should act as a dispatcher. It shouldn't contain deep logic for ingestion or career coaching, but rather *delegate* to them.
*   **Menu Structure:**
    *   `[1] Ingest Log` -> Triggers Ingestor (Placeholder for Epic 2)
    *   `[2] Oracle Query` -> Triggers Oracle (Placeholder for Epic 3)
    *   `[3] Career Coach` -> Triggers Coach (Placeholder for Epic 4)

### Persona Guidelines (Ref: FR2)

*   **Role:** Senior Scrum Master Coach.
*   **Tone:** Direct, pragmatic, data-driven. No fluff.
*   **Signature:** Ensure the agent signs off or behaves consistently with the "FREYA" identity.

### References

*   [Source: docs/epics.md#Story 1.2]
*   [Source: docs/prd.md#Functional Requirements]

### File List

- .agent/rules/freya/agents/master.mdc
- .agent/rules/freya/index.mdc
