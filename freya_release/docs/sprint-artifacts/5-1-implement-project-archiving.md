# Story 5.1: Implement Project Archiving

Status: done

## Story

As a User,
I want to mark a project as "Archived" when it ends,
So that it stops appearing in my active autocomplete and daily summaries.

## Acceptance Criteria

1.  **Given** a project like "Vivo - Projeto Antigo",
2.  **When** I ask "Arquivar projeto Vivo - Projeto Antigo",
3.  **Then** the system should update the metadata in `status.json` setting `active: false` and `archivedAt: [Date]`.
4.  **And** it should ideally move the folder to `/data/Archive/Clients/...` (Or just filter it out). *Decision: Use `active: false` flag for now to avoid breaking paths, but ensure Oracle ignores it by default.*

## Tasks / Subtasks

- [ ] Task 1: Update Ingestor Rule (`ingestor.mdc`)
    - [ ] Add logic to handle "Archive" or "Close" actions.
    - [ ] Update `status.json` schema to support `active` (boolean) and `archivedAt` (date).
- [ ] Task 2: Update Oracle Rule (`oracle.mdc`)
    - [ ] Add a filter step: Ignore projects where `active: false` UNLESS the user explicitly asks for "history" or "archives".
- [ ] Task 3: Test Archiving
    - [ ] Create a dummy project.
    - [ ] Archive it via chat command.
    - [ ] Verify `status.json` update.
    - [ ] Verify Oracle ignores it in standard queries.

## Dev Notes

### Technical Requirements

*   **Schema Update:** Ensure `active` defaults to `true` for existing files if missing (or handle gracefully in code).
*   **Search Impact:** The `Glob` tool finds all files. The Oracle agent needs to *read* the file and check the `active` flag before using it in a standard context.

## References

*   [Source: docs/epics.md#Story 5.1]
