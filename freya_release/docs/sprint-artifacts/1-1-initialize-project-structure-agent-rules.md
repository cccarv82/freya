# Story 1.1: Initialize Project Structure & Agent Rules

Status: done

## Story

As a Developer,
I want to set up the `.agent/rules/freya` directory structure and base configuration files,
So that I have a clean foundation for implementing the agent personas.

## Acceptance Criteria

1.  **Given** the project root is empty or contains only docs, **When** I run the setup commands, **Then** the directory `.agent/rules/freya/agents` and `.agent/rules/freya/workflows` should exist.
2.  **And** the `/data/career`, `/data/clients` and `/logs/daily` directories should be created.
3.  **And** a `README.md` should document this structure in the root or `.agent` folder.
4.  **And** a basic `.gitignore` should be created to ignore `/logs` (optional, but recommended) but KEEP `/data`.

## Tasks / Subtasks

- [x] Task 1: Create Directory Structure
    - [x] Create `.agent/rules/freya/agents`
    - [x] Create `.agent/rules/freya/workflows`
    - [x] Create `data/career`
    - [x] Create `data/clients`
    - [x] Create `logs/daily`
- [x] Task 2: Create Documentation & Config
    - [x] Create `README.md` explaining the folder purpose
    - [x] Create/Update `.gitignore` to ensure `data/` is tracked (if desired for local persistence) but maybe ignore large logs. *Decision:* Since this is local-first, we likely WANT to git ignore personal data if this repo is shared, BUT for a personal repo, we track it. *Instruction:* Add `data/` to gitignore ONLY if the user intends to publish the code. For now, create a `.gitignore` ignoring `logs/` but allowing `data/`.

## Dev Notes

### Technical Requirements

*   **No External Dependencies:** Do not use `npm init` or python scripts. Use simple shell commands (mkdir, touch) or the IDE's file creation capabilities.
*   **Idempotency:** The setup should not fail if folders already exist (use `mkdir -p`).

### Project Structure Alignment

*   **Source of Truth:** `docs/architecture.md` (Project Structure & Boundaries).
*   **Deviation Check:** The architecture specifies `.agent/rules/freya`. Ensure this exact path is used, not `.cursor/rules`.

### Developer Guardrails

*   **DO NOT** create the agent files (`master.mdc`, `ingestor.mdc`) in this story. Only the *folders* where they will live.
*   **DO NOT** create the schema files yet.

## References

*   [Source: docs/architecture.md#Project Structure & Boundaries]
*   [Source: docs/epics.md#Story 1.1]

### File List

- .agent/rules/freya/agents/
- .agent/rules/freya/workflows/
- data/career/
- data/clients/
- logs/daily/
- README.md
- .gitignore
