
### Epic 11: Intelligent Status & Reporting Evolution
Evoluir a inteligência da Freya para inferir tarefas automaticamente e gerar relatórios de status executivos profissionais (Diário/Semanal) que consolidem tarefas, registros diários (logs) e status de projetos.

### Story 11.1: Implement Implicit Task Detection
As a User,
I want Freya to automatically detect and create tasks when I mention future actions in my status updates (e.g., "preciso configurar X"),
So that I don't have to explicitly say "Create task" every time.

**Acceptance Criteria:**
1. **Given** a user input like "O projeto atrasou porque preciso configurar o servidor",
2. **When** the ingestor processes the text,
3. **Then** it should identify "Configurar o servidor" as a potential task.
4. **And** it should check if a similar task already exists (deduplication).
5. **And** if not, it should create a task in `task-log.json` linked to the relevant project.
6. **And** it should inform the user: "Detectei e criei a tarefa: [descrição]".

### Story 11.2: Implement Professional Status Report Generator
As a User,
I want to generate a "Professional Status Report" (Daily/Weekly) that aggregates Tasks, Project Updates, and Daily Logs into a structured executive summary,
So that I can send it to stakeholders without manual editing.

**Acceptance Criteria:**
1. **Given** data in `task-log.json`, `status.json` (projects), and `logs/daily/*.md`,
2. **When** I ask for "Gerar status report",
3. **Then** the system should aggregate:
    *   **Completed Tasks:** From `task-log.json`.
    *   **Project Progress:** From `status.json` history.
    *   **Context/Notes:** Extract relevant summaries from `logs/daily`.
4. **And** it should format the output into sections: "Resumo Executivo", "Principais Entregas", "Pontos de Atenção/Bloqueios", "Próximos Passos".
5. **And** the output should be polished and professional (Markdown).
