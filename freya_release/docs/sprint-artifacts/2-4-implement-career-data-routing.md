# Story 2.4: Implement Career Data Routing

Status: done

## Story

As a User,
I want inputs related to my career (feedbacks, kudos, certs) to go to a separate log,
So that they don't get lost inside project folders.

## Acceptance Criteria

1.  **Given** an input classified as "Career" or "Personal Growth",
2.  **When** the ingestion router acts,
3.  **Then** the data must be written to `data/career/career-log.json`.
4.  **And** it should tag the entry with a category (e.g., "Kudos", "Certification", "Goal").

## Tasks / Subtasks

- [ ] Task 1: Add Career Routing Logic to Ingestor
    - [ ] Update `.agent/rules/freya/agents/ingestor.mdc` to handle the `Career` domain events.
    - [ ] Logic:
        1. Target file: `data/career/career-log.json`.
        2. Check existence/schema.
        3. Append new entry to `entries` array.
        4. Write back atomic.
- [ ] Task 2: Verify Schema Compliance
    - [ ] Ensure the generated ID is unique (simple random string or timestamp is fine for now).

## Dev Notes

### Technical Requirements

*   **Atomic Write:** Same logic as Project Status.
*   **ID Generation:** `Math.random().toString(36).substr(2, 9)` style is sufficient for local single-user.

## References

*   [Source: docs/epics.md#Story 2.4]
*   [Source: data/schemas.md#Career Log]
