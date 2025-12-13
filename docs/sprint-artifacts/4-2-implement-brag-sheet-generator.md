# Story 4.2: Implement "Brag Sheet" Generator

Status: done

## Story

As a User,
I want to generate a list of my achievements for a specific period (e.g., "last 6 months"),
So that I can prepare for my performance review.

## Acceptance Criteria

1.  **Given** a request like "Gere minha brag sheet do último semestre",
2.  **When** the Coach agent runs,
3.  **Then** it should filter `career-log.json` entries by date range.
4.  **And** it should format the output as a Markdown list, grouped by category (Impact, Learning, Leadership).

## Tasks / Subtasks

- [ ] Task 1: Implement Date Filtering Logic
    - [ ] Update `.agent/rules/freya/agents/coach.mdc`.
    - [ ] Add instructions to parse natural language ranges ("last 6 months", "this year") into `YYYY-MM-DD`.
    - [ ] Filter the JSON array based on `date`.
- [ ] Task 2: Implement Grouping & Formatting
    - [ ] Group filtered entries by `type`.
    - [ ] Format as:
        ```markdown
        ### 🏆 Achievements
        * [YYYY-MM-DD] Description (Tags)

        ### 📚 Learning
        * [YYYY-MM-DD] Description (Tags)
        ```
- [ ] Task 3: Dry Run Test
    - [ ] Create `tests/career_examples.md` with dummy data and verify filtering logic.

## Dev Notes

### Technical Requirements

*   **Date Math:** The LLM can do simple date math, but be explicit about the "current date" context.
*   **Categories:** Map internal types (Certification, Goal) to user-friendly headers (Learning, Ambitions).

## References

*   [Source: docs/epics.md#Story 4.2]
*   [Source: docs/sprint-artifacts/epic-3-retro-2025-12-12.md#Action Items]
