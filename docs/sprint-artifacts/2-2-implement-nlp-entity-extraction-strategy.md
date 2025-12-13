# Story 2.2: Implement NLP Entity Extraction Strategy

Status: done

## Story

As a System,
I want to analyze unstructured text and extract structured entities (Client, Project, Date, Status, Blockers),
So that I can organize the information automatically.

## Acceptance Criteria

1.  **Given** a chaotic input like "Reunião com a Vivo, projeto 5G atrasou por causa da chuva",
2.  **When** the `ingestor.mdc` agent processes it,
3.  **Then** it should extract: `{ Client: "Vivo", Project: "5G", Status: "Delayed", Reason: "Rain" }`.
4.  **And** it must correctly identify multiple contexts in a single message (e.g., project update + career goal).

## Tasks / Subtasks

- [x] Task 1: Define NLP Prompt Strategy
    - [x] Update `.agent/rules/freya/agents/ingestor.mdc` with instructions to parse text AFTER safe logging.
    - [x] Create a "Schema Definition" block within the agent rule to guide the LLM's extraction.
- [x] Task 2: Implement Multi-Context Handling
    - [x] Instruct the agent to output a JSON array of events, not just a single object.
    - [x] Handle ambiguous inputs (ask for clarification if entity is missing).
- [x] Task 3: Dry Run Tests
    - [x] Create a test file `tests/ingestion_examples.md` with chaotic inputs and expected JSON outputs to verify the prompt's effectiveness manually.

## Dev Notes

### Technical Requirements

*   **Prompt Engineering:** The core of this story is writing a really good system prompt for the `ingestor`.
*   **JSON Output:** The agent must output STRICT JSON in a code block for the next step (Story 2.3) to consume.
*   **Entities to Extract:** `Client`, `Project`, `Date` (default to today if missing), `Type` (Status, Blocker, Decision), `Content`.

## References

*   [Source: docs/epics.md#Story 2.2]
*   [Source: docs/architecture.md#Ingestion Flow]
