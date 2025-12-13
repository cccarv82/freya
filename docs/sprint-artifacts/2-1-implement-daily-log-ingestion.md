# Story 2.1: Implement Daily Log Ingestion (The Safety Net)

Status: done

## Story

As a User,
I want every interaction to be immediately logged to a daily markdown file,
So that I have an immutable record of my day even if the structured parsing fails.

## Acceptance Criteria

1.  **Given** a user input string, **When** the ingestion workflow starts, **Then** the raw input must be appended to `logs/daily/YYYY-MM-DD.md` with a timestamp `[HH:mm:ss]`.
2.  **And** this must happen BEFORE any complex parsing (Atomic/Safe).

## Tasks / Subtasks

- [x] Task 1: Create Ingestor Agent Rule
    - [x] Create `.agent/rules/freya/agents/ingestor.mdc`.
    - [x] Define the primary responsibility: "Safe Logging First".
- [x] Task 2: Implement "Safe Log" Logic
    - [x] Add instructions to `ingestor.mdc` to handle the appending to `logs/daily/{date}.md`.
    - [x] Ensure the file is created if it doesn't exist.
    - [x] Define the format: `\n\n## [HH:mm] Raw Input\n{input}\n`.
- [x] Task 3: Connect Entry Point
    - [x] Update `.agent/rules/freya/index.mdc` to route "Ingest Log" (Option 1) to this new agent.

## Dev Notes

### Technical Requirements

*   **Fail-Safe:** This is the most critical step. If this fails, data is lost. It must be robust.
*   **Timestamp:** Use the system time.
*   **Format:** Markdown append.

## References

*   [Source: docs/epics.md#Story 2.1]
*   [Source: docs/architecture.md#Data Flow]
