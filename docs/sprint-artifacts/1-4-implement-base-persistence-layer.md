# Story 1.4: Implement Base Persistence Layer

Status: done

## Story

As a System,
I want to have the JSON schemas and Log files initialized,
So that data has a place to live from Day 1.

## Acceptance Criteria

1.  **Given** the system initialization, **When** the agent starts, **Then** it should verify if `data/career/career-log.json` exists, and create it if missing with an empty schema `{ "entries": [] }`.
2.  **And** it should be able to append a simple text line to `logs/daily/{today}.md` (This will be tested by a unit test).
3.  **And** the JSON schema for career entries must be defined (Date, Type, Description, Tags).

## Tasks / Subtasks

- [x] Task 1: Initialize Career Log
    - [x] Create/Check `data/career/career-log.json`.
    - [x] Ensure it initializes with valid empty JSON structure `{ "entries": [] }` if missing.
- [x] Task 2: Implement Daily Log Rotation (Simple)
    - [x] Create a helper (or instructions in `ingestor.mdc` later, but here we just ensure the FOLDER works) to find `logs/daily/YYYY-MM-DD.md`.
    - [x] Create a dummy file `logs/daily/TEST-LOG.md` to verify permissions and path.
- [x] Task 3: Define Schemas (Documentation)
    - [x] Create `data/schemas.md` (or similar) to document the expected JSON structure for Career and Projects. This acts as the "Database Schema".

## Dev Notes

### Technical Requirements

*   **JSON Structure:**
    *   `career-log.json`: Root object with `entries` array.
*   **Atomic Writes:** Although this is just initialization, future writes must be atomic. For now, just create the empty files.
*   **Manual Test:** You can verify by running `cat data/career/career-log.json` after the task.

### Developer Guardrails

*   **No Database:** Do not install SQLite or local storage libs. Standard File I/O only.

## References

*   [Source: docs/epics.md#Story 1.4]
*   [Source: docs/architecture.md#Implementation Patterns]
