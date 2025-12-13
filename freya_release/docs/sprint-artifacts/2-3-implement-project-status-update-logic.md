# Story 2.3: Implement Project Status Update Logic

Status: done

## Story

As a System,
I want to update the specific JSON file for a project based on the extracted entities,
So that the project history is maintained.

## Acceptance Criteria

1.  **Given** extracted project data (from Story 2.2),
2.  **When** the system writes to the persistence layer,
3.  **Then** it should locate (or create) `/data/Clients/{Client}/{Project}/status.json`.
4.  **And** it should append a new entry to the `history` array, preserving previous entries.
5.  **And** it should update the `currentStatus` summary field.

## Tasks / Subtasks

- [ ] Task 1: Add Update Logic to Ingestor
    - [ ] Update `.agent/rules/freya/agents/ingestor.mdc` to handle the `Project` domain events.
    - [ ] Logic:
        1. Slugify Client and Project names (e.g., "Vivo", "5G" -> `data/Clients/vivo/5g/status.json`).
        2. Check if file exists. If not, create with basic schema.
        3. Read existing content.
        4. Append new event to `history`.
        5. Update `currentStatus` with the new content (or a summary if we add summarization later).
        6. Update `lastUpdated` timestamp.
        7. Write back atomically.
- [ ] Task 2: Define Status Schema
    - [ ] Create/Update `data/schemas.md` with the official `status.json` structure.

## Dev Notes

### Technical Requirements

*   **Slug Generation:** Use a simple consistent slug strategy (lowercase, dashes).
*   **Atomic Write:** Ensure we don't corrupt the JSON.
*   **Directory Creation:** If `data/Clients/vivo` doesn't exist, create it.

## References

*   [Source: docs/epics.md#Story 2.3]
*   [Source: docs/architecture.md#Data Structure]
