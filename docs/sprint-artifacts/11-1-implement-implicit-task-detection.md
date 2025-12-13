# Story 11.1: Implement Implicit Task Detection

Status: done

## Story

As a User,
I want Freya to automatically detect and create tasks when I mention future actions in my status updates (e.g., "preciso configurar X"),
So that I don't have to explicitly say "Create task" every time.

## Acceptance Criteria

1. **Given** a user input like "O projeto atrasou porque preciso configurar o servidor",
2. **When** the ingestor processes the text,
3. **Then** it should identify "Configurar o servidor" as a potential task.
4. **And** it should check if a similar task already exists (deduplication).
5. **And** if not, it should create a task in `task-log.json` linked to the relevant project.
6. **And** it should inform the user: "Detectei e criei a tarefa: [descrição]".

## Dev Notes

### Developer Context
This story aims to make the ingestion process smarter. Instead of just logging text or requiring explicit commands ("Create task X"), the agent should infer tasks from natural language patterns indicating future obligation or intent.

### Technical Requirements
*   **Target File:** `.agent/rules/freya/agents/ingestor.mdc`
*   **Logic Update:**
    *   Add a new detection step for "Implicit Tasks".
    *   **Keywords/Patterns:** "preciso", "tenho que", "vou", "falta", "pendente", "todo".
    *   **Deduplication Logic:** Before adding to `task-log.json`, search existing PENDING tasks for fuzzy matches (e.g., Levenshtein distance concept or simple substring match).
    *   **Project Linking:** If the input also detected a Project entity, link the task to it (`projectSlug`).

### Architecture Compliance
*   **Agent Autonomy:** The Ingestor agent is authorized to write to `task-log.json`.
*   **Safety:** Always prefer *creating* a duplicate over *missing* a task if unsure, but try to avoid obvious duplicates.
*   **User Feedback:** Crucial to inform the user that a task was auto-created so they know it's tracked.

### Previous Story Intelligence
*   **Epic 6:** Task schema is already defined in `task-log.json`. We are just improving the *input* method.
*   **Ingestor Logic:** Currently handles explicit "Task" domain. We need to expand this to allow "Project" domain inputs to *also* trigger "Task" creation (multi-domain output).

## Dev Agent Record

### Context Reference
*   Sources: `docs/epics.md`, `.agent/rules/freya/agents/ingestor.mdc`.

### Agent Model Used
*   bm-ad-sm-v6

### Completion Notes List
*   Focus on the "multi-domain" aspect: A single input can now be both a Project Status Update AND a Task Creation event.

## Implementation Details (2025-12-13)

### Changes
*   **Modified `.agent/rules/freya/agents/ingestor.mdc`**:
    *   **Parsing Logic:** Added "Implicit Detection" block to catch keywords like "preciso", "falta", "tenho que".
    *   **Multi-Domain:** Enabled simultaneous Project Update and Task Creation events from a single input.
    *   **Linking:** Added logic to derive `projectSlug` from Client/Project entities found in the context.
    *   **Deduplication:** Added a check against existing PENDING tasks to prevent creating duplicates if a similar description is found.

## Senior Developer Review (AI)

### Review Summary
**Date:** 2025-12-13
**Reviewer:** Architect Agent
**Status:** Approved

### Findings
1.  **Logic Correctness:** The updates to `ingestor.mdc` correctly introduce the concept of "Implicit Detection" and handle the complex case of multi-domain extraction (Project + Task).
2.  **Safety:** The `Deduplication Check` logic added to the create action is a crucial safety mechanism to prevent log pollution.
3.  **Architecture:** Maintains the "Prompt-as-Code" architecture by embedding the logic in the rule file.
