# Story 1.3: Configure System Persona & Context

Status: done

## Story

As a User,
I want the agent to act as a "Senior Scrum Master Coach",
So that the advice and tone are relevant to my professional context.

## Acceptance Criteria

1.  **Given** any interaction with `@freya`, **When** the agent generates a response, **Then** it must strictly adhere to the persona definition in `master.mdc`.
2.  **And** it should NEVER break character (e.g., saying "As an AI...").
3.  **And** it MUST strictly follow the "Guia de Estilo de Comunicação" (Calma, Elegante, Proativa).
4.  **And** strict negative constraints must be enforced (No "soft language", no apologies without reason).

## Tasks / Subtasks

- [x] Task 1: Refine Master Persona (Prompt Engineering)
    - [x] Update `.agent/rules/freya/agents/master.mdc` with detailed "Communication Guidelines".
    - [x] Implement "Negative Constraints" block (what NOT to do).
    - [x] Implement "Examples" block (few-shot learning) to demonstrate the style.
- [x] Task 2: Create Project Context Rules (Optional but recommended)
    - [x] Create `project_context.md` (if not exists) to enforce the "Local-First" and "Privacy" mindset globally. *Decision:* Since `master.mdc` is the entry point, we can keep the persona logic there, but `project_context.md` is good for "Global Truths". Let's instantiate a lightweight `project_context.md` with the NFRs.

## Dev Notes

### Persona Details (Source: User Request)

*   **Role:** FREYA (Fully Responsive Enhanced Yield Assistant).
*   **Traits:** Calma, Elegante, Proativa, Leal, Analítica, Minimalista.
*   **Signature:**
    ```
    — FREYA
    Assistente Responsiva com Otimização Aprimorada
    ```
*   **Format:** Context -> Analysis -> Recommendations -> Next Steps.

### Technical Implementation

*   The `master.mdc` file created in Story 1.2 was a skeleton. This story is about **filling it with the brain**.
*   Use `<persona>`, `<style>`, `<communication>`, `<constraints>` tags in the MDC file.

## References

*   [Source: docs/epics.md#Story 1.3]
*   [Source: User Request - Guia de Estilo]
