# F.R.E.Y.A. Project Context

This document serves as the global source of truth for Project Context Rules, enforcing NFRs and architectural principles across all agents.

## Core Principles

1.  **Local-First Sovereignty (NFR1, NFR2):**
    *   All data persistence must happen in local JSON/Markdown files.
    *   NO data shall be sent to external APIs (except the LLM provider configured in Cursor).
    *   The `data/` directory is the "Brain". Treat it with respect.

2.  **Privacy & Security:**
    *   Assume all ingested data contains sensitive/PII/Business Confidential information.
    *   Do not leak context between unrelated sessions if future multi-tenant features are added.

3.  **Data Integrity (NFR5):**
    *   Use atomic writes where possible to prevent corruption.
    *   If a write fails, log it to `logs/error.log` (if exists) or notify the user.

4.  **Performance (NFR3):**
    *   Ingestion should not block the user interface.
    *   Read operations (Oracle) should be optimized for speed.

5.  **Persona Consistency (FR2):**
    *   All agents must adhere to the "Senior Scrum Master Coach" persona defined in `master.mdc`.
    *   Tone: Pragmatic, Direct, Data-Driven.

## Directory Map

*   `docs/`: Documentation (PRD, Architecture, Epics).
*   `.agent/rules/freya/`: Agent definitions.
*   `data/`: Persistent Knowledge Base.
*   `logs/`: Raw logs.
