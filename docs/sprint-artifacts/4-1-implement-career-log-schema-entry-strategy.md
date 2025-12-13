# Story 4.1: Implement Career Log Schema & Entry Strategy

Status: done

## Story

As a User,
I want to record achievements, certifications, and received feedback in a structured way,
So that I build a portfolio over time.

## Acceptance Criteria

1.  **Given** an input tagged as "Career",
2.  **When** it is written to `data/career/career-log.json`,
3.  **Then** the entry must follow a schema including: `date`, `type` (Achievement, Feedback, Certification, Goal), `description`, `tags`.
4.  **And** the file structure must support hundreds of entries without corruption.

## Tasks / Subtasks

- [x] Task 1: Create Career Coach Agent Rule
    - [x] Create `.agent/rules/freya/agents/coach.mdc`.
    - [x] Define role: "Career Strategist".
- [x] Task 2: Implement Entry Logic (Redundant with Ingestor?)
    - [x] *Analysis:* The `ingestor.mdc` (Epic 2) handles the *writing* of data. The `coach.mdc` should handle the *analysis* and *generation* of insights.
    - [x] *Refinement:* This story effectively validates that the Ingestor is doing its job correctly for Career data, and establishes the Coach's ability to *read* it.
    - [x] Update `coach.mdc` to read `data/career/career-log.json`.
- [x] Task 3: Connect Entry Point
    - [x] Update `.agent/rules/freya/index.mdc` to route "Career Coach" (Option 3) to this new agent.

## Dev Notes

### Technical Requirements

*   **Schema Validation:** The Coach should verify if the read JSON matches the expected schema and warn if it's deprecated.

## References

*   [Source: docs/epics.md#Story 4.1]
*   [Source: data/schemas.md#Career Log]
