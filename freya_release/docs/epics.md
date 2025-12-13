     1|---
     2|stepsCompleted:
     3|  - 1
     4|  - 2
     5|  - 3
     6|  - 4
     7|inputDocuments:
     8|  - docs/prd.md
     9|  - docs/architecture.md
    10|---
    11|
    12|# freya - Epic Breakdown
    13|
    14|## Overview
    15|
    16|This document provides the complete epic and story breakdown for freya, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.
    17|
    18|## Requirements Inventory
    19|
    20|### Functional Requirements
    21|
    22|- FR1: O usuário pode invocar o agente no chat do Cursor/VSCode usando linguagem natural.
    23|- FR2: O sistema deve responder adotando exclusivamente a persona "FREYA" (Calma, Elegante, Proativa, Analítica, Minimalista) conforme Guia de Estilo.
    24|- FR3: O sistema deve manter o contexto da conversa ativa (thread) para perguntas de acompanhamento.
    25|- FR4: O sistema deve aceitar inputs de texto não estruturado contendo múltiplos contextos (ex: status de projeto misturado com metas de carreira).
    26|- FR5: O sistema deve identificar e extrair automaticamente entidades do texto (Nomes de Projetos, Datas, Pessoas, Bloqueios).
    27|- FR6: O sistema deve categorizar cada fragmento de informação extraído em um dos domínios suportados: "Project", "Career", "Blocker" ou "General Log".
    28|- FR7: O sistema deve manter uma estrutura de diretórios hierárquica e semântica (ex: `/data/Clients/Vivo/VivoPlus/PaymentStream/status.json`) para suportar escalabilidade de longo prazo.
    29|- FR8: O sistema deve gerar um "Daily Log" (arquivo Markdown) contendo o registro bruto e imutável de todas as interações do dia.
    30|- FR9: O sistema deve atualizar os arquivos JSON estruturados sem sobrescrever dados históricos (append/update logic).
    31|- FR15 (Lifecycle Management): O sistema deve permitir marcar projetos/temas como "Archived", removendo-os da visualização ativa diária mas mantendo-os disponíveis para busca histórica.
    32|- FR10: O usuário pode solicitar resumos de status por projeto (ex: "Status do Vivo+").
    33|- FR11: O sistema deve ler os arquivos JSON locais para responder a perguntas factuais.
    34|- FR12: O sistema deve citar a data/origem da informação ao fornecer uma resposta factual (para evitar alucinação).
    35|- FR13: O sistema deve registrar conquistas, feedbacks e certificações no `career-log.json`.
    36|- FR14: O usuário pode solicitar a geração de um "Brag Sheet" (lista de conquistas) filtrado por período.
    37|
    38|### NonFunctional Requirements
    39|
    40|- NFR1: Nenhum dado do usuário (texto de entrada ou JSONs processados) deve ser enviado para servidores externos ou telemetria de terceiros, exceto para a API do LLM configurado no Cursor.
    41|- NFR2: Todos os arquivos de dados devem residir estritamente dentro do diretório do projeto ou workspace local do usuário.
    42|- NFR3: O processamento de ingestão (NLP parsing) não deve bloquear a thread principal do editor (UI freeze) por mais de 50ms.
    43|- NFR4: O "Oracle Query" deve retornar respostas em menos de 5 segundos para consultas em bases de conhecimento < 10MB.
    44|- NFR5 (Atomic Writes): Todas as operações de escrita em arquivos JSON devem usar escrita atômica.
    45|- NFR6 (Fallback Logging): Em caso de falha no parsing estruturado, o input original DEVE ser anexado ao `daily-log.md` como texto plano.
    46|- NFR7: Os arquivos JSON devem seguir um Schema rigoroso.
    47|
    48|### Additional Requirements
    49|
    50|- **Architecture:** Agent System using Markdown-based rules (`.mdc`).
    51|- **Architecture:** Local-first JSON persistence (Sharded strategy).
    52|- **Architecture:** No external database or MCP dependency.
    53|- **Architecture:** Directory structure: `.agent/rules/freya`, `data/`, `logs/`.
    54|
    55|### FR Coverage Map
    56|
    57|- FR1: Epic 1
    58|- FR2: Epic 1
    59|- FR3: Epic 1
    60|- FR4: Epic 2
    61|- FR5: Epic 2
    62|- FR6: Epic 2
    63|- FR7: Epic 1
    64|- FR8: Epic 2
    65|- FR9: Epic 1
    66|- FR10: Epic 3
    67|- FR11: Epic 3
    68|- FR12: Epic 3
    69|- FR13: Epic 4
    70|- FR14: Epic 4
    71|- FR15: Epic 5
    72|
    73|## Epic List
    74|
    75|### Epic 1: The Core Agent System
    76|Estabelecer a infraestrutura de agentes (regras .mdc) e a persona da F.R.E.Y.A., permitindo interação conversacional básica e persistência de arquivos.
    77|**FRs covered:** FR1, FR2, FR3, FR7, FR9
    78|
    79|### Epic 2: Universal Ingestion
    80|Implementar a lógica de parseamento de linguagem natural para transformar inputs não estruturados em dados JSON estruturados (Projetos/Carreira) e Logs Diários.
    81|**FRs covered:** FR4, FR5, FR6, FR8
    82|
    83|### Epic 3: The Oracle (Recall & Retrieval)
    84|Habilitar a capacidade de leitura e síntese de informações a partir da base de conhecimento JSON local para responder perguntas de status.
    85|**FRs covered:** FR10, FR11, FR12
    86|
    87|### Epic 4: Career Coach Module
    88|Implementar o registro e recuperação de dados específicos de carreira (feedbacks, conquistas) para geração de "Brag Sheets".
    89|**FRs covered:** FR13, FR14
    90|
    91|### Epic 5: Lifecycle Management
    92|Adicionar capacidades de arquivamento e gestão de ciclo de vida de projetos para manter a base de conhecimento limpa e performática.
    93|**FRs covered:** FR15
    94|
    95|### Epic 6: Task Management System
    96|Implementar um sistema leve de gestão de tarefas (TODOs) integrado ao fluxo de ingestão e consulta.
    97|**FRs covered:** New FR (Task Tracking)
    98|
    99|### Epic 7: System Health & Maintenance
   100|Implementar ferramentas de diagnóstico e validação de dados para garantir a integridade da base de conhecimento local.
   101|**FRs covered:** NFR7 (Schema Validation)
   102|
   103|### Epic 8: Reporting Engine
   104|Implementar a geração de relatórios consolidados (Semanal e Diário) para facilitar o acompanhamento do progresso.
   105|**FRs covered:** New FR (Reporting)
   106|
   107|### Epic 9: Agent-Script Integration
   108|Habilitar a execução automática de scripts de manutenção e relatório através da interface de chat da Freya.
   109|**FRs covered:** FR1 (Natural Language Invocation for Scripts)
   110|
   111|## Epic 1: The Core Agent System
   112|Estabelecer a infraestrutura de agentes (regras .mdc) e a persona da F.R.E.Y.A., permitindo interação conversacional básica e persistência de arquivos.
   113|
   114|### Story 1.1: Initialize Project Structure & Agent Rules
   115|
   116|As a Developer,
   117|I want to set up the `.agent/rules/freya` directory structure and base configuration files,
   118|So that I have a clean foundation for implementing the agent personas.
   119|
   120|**Acceptance Criteria:**
   121|
   122|**Given** the project root is empty or contains only docs,
   123|**When** I run the setup commands,
   124|**Then** the directory `.agent/rules/freya/agents` and `.agent/rules/freya/workflows` should exist.
   125|**And** the `/data/career`, `/data/clients` and `/logs/daily` directories should be created.
   126|**And** a `README.md` should document this structure.
   127|
   128|### Story 1.2: Implement Entry Point & Router (@freya)
   129|
   130|As a User,
   131|I want to invoke `@freya` in the chat and see a menu of options,
   132|So that I know how to interact with the system.
   133|
   134|**Acceptance Criteria:**
   135|
   136|**Given** the user types `@freya` or `@freya help`,
   137|**When** the agent processes the input,
   138|**Then** it should display a menu with options: "Ingest Log", "Oracle Query", "Career Coach".
   139|**And** it should respond using the defined communication style (Pragmatic/Direct).
   140|
   141|### Story 1.3: Configure System Persona (FREYA)
   142|
   143|As a User,
   144|I want the agent to act as "FREYA" (Intelligent, Objective, Strategist),
   145|So that the interaction feels professional, calming, and efficient.
   146|
   147|**Acceptance Criteria:**
   148|
   149|**Given** any interaction with `@freya`,
   150|**When** the agent generates a response,
   151|**Then** it must strictly adhere to the persona definition in `master.mdc`.
   152|**And** the tone must be: Calma, Elegante, Proativa, Analítica, Minimalista.
   153|**And** the response structure must follow: Contexto, Análise, Recomendações, Próximos Passos.
   154|**And** it must avoid "soft" language ("acho", "talvez") and apologies without reason.
   155|**And** it MUST end with the signature:
   156|`— FREYA`
   157|`Assistente Responsiva com Otimização Aprimorada`
   158|
   159|### Story 1.4: Implement Base Persistence Layer
   160|
   161|As a System,
   162|I want to have the JSON schemas and Log files initialized,
   163|So that data has a place to live from Day 1.
   164|
   165|**Acceptance Criteria:**
   166|
   167|**Given** the system initialization,
   168|**When** the agent starts,
   169|**Then** it should verify if `data/career/career-log.json` exists, and create it if missing with an empty schema `{ "entries": [] }`.
   170|**And** it should be able to append a simple text line to `logs/daily/{today}.md`.
   171|
   172|## Epic 2: Universal Ingestion
   173|Implementar a lógica de parseamento de linguagem natural para transformar inputs não estruturados em dados JSON estruturados (Projetos/Carreira) e Logs Diários.
   174|
   175|### Story 2.1: Implement Daily Log Ingestion (The Safety Net)
   176|
   177|As a User,
   178|I want every interaction to be immediately logged to a daily markdown file,
   179|So that I have an immutable record of my day even if the structured parsing fails.
   180|
   181|**Acceptance Criteria:**
   182|
   183|**Given** a user input string,
   184|**When** the ingestion workflow starts,
   185|**Then** the raw input must be appended to `logs/daily/YYYY-MM-DD.md` with a timestamp `[HH:mm:ss]`.
   186|**And** this must happen BEFORE any complex parsing (Atomic/Safe).
   187|
   188|### Story 2.2: Implement NLP Entity Extraction Strategy
   189|
   190|As a System,
   191|I want to analyze unstructured text and extract structured entities (Client, Project, Date, Status, Blockers),
   192|So that I can organize the information automatically.
   193|
   194|**Acceptance Criteria:**
   195|
   196|**Given** a chaotic input like "Reunião com a Vivo, projeto 5G atrasou por causa da chuva",
   197|**When** the `ingestor.mdc` agent processes it,
   198|**Then** it should extract: `{ Client: "Vivo", Project: "5G", Status: "Delayed", Reason: "Rain" }`.
   199|**And** it must correctly identify multiple contexts in a single message.
   200|
   201|### Story 2.3: Implement Project Status Update Logic
   202|
   203|As a System,
   204|I want to update the specific JSON file for a project based on the extracted entities,
   205|So that the project history is maintained.
   206|
   207|**Acceptance Criteria:**
   208|
   209|**Given** extracted project data,
   210|**When** the system writes to the persistence layer,
   211|**Then** it should locate (or create) `/data/Clients/{Client}/{Project}/status.json`.
   212|**And** it should append a new entry to the `history` array, preserving previous entries.
   213|**And** it should update the `currentStatus` summary field.
   214|
   215|### Story 2.4: Implement Career Data Routing
   216|
   217|As a User,
   218|I want inputs related to my career (feedbacks, kudos, certs) to go to a separate log,
   219|So that they don't get lost inside project folders.
   220|
   221|**Acceptance Criteria:**
   222|
   223|**Given** an input classified as "Career" or "Personal Growth",
   224|**When** the ingestion router acts,
   225|**Then** the data must be written to `data/career/career-log.json`.
   226|**And** it should tag the entry with a category (e.g., "Kudos", "Certification", "Goal").
   227|
   228|## Epic 3: The Oracle (Recall & Retrieval)
   229|Habilitar a capacidade de leitura e síntese de informações a partir da base de conhecimento JSON local para responder perguntas de status.
   230|
   231|### Story 3.1: Implement Project Lookup Mechanism
   232|
   233|As a User,
   234|I want to ask "How is project X?" and have the system find the correct file,
   235|So that I don't have to manually browse folders.
   236|
   237|**Acceptance Criteria:**
   238|
   239|**Given** a query like "Status Vivo+",
   240|**When** the Oracle agent activates,
   241|**Then** it should search the `/data/Clients` directory for matching slugs/names.
   242|**And** it should read the content of the relevant `status.json`.
   243|
   244|### Story 3.2: Implement Status Summarization
   245|
   246|As a User,
   247|I want a concise summary of the latest events, not a raw dump of the JSON,
   248|So that I can quickly catch up on context.
   249|
   250|**Acceptance Criteria:**
   251|
   252|**Given** a JSON file with 50 historical entries,
   253|**When** the Oracle answers,
   254|**Then** it should prioritize the `currentStatus` and the last 3 `history` entries.
   255|**And** it should synthesize a natural language response (e.g., "The project is on track, last update was yesterday...").
   256|
   257|### Story 3.3: Implement Fact Citation (Anti-Hallucination)
   258|
   259|As a User,
   260|I want to know WHEN an update was made,
   261|So that I trust the data.
   262|
   263|**Acceptance Criteria:**
   264|
   265|**Given** any factual claim in the response,
   266|**When** the response is generated,
   267|**Then** it must include the date of the source entry (e.g., "[Updated: 2023-10-27]").
   268|**And** if no data exists, it must explicitly say "I have no records for this project."
   269|
   270|## Epic 4: Career Coach Module
   271|Implementar o registro e recuperação de dados específicos de carreira (feedbacks, conquistas) para geração de "Brag Sheets".
   272|
   273|### Story 4.1: Implement Career Log Schema & Entry Strategy
   274|
   275|As a User,
   276|I want to record achievements, certifications, and received feedback in a structured way,
   277|So that I build a portfolio over time.
   278|
   279|**Acceptance Criteria:**
   280|
   281|**Given** an input tagged as "Career",
   282|**When** it is written to `data/career/career-log.json`,
   283|**Then** the entry must follow a schema including: `date`, `type` (Achievement, Feedback, Certification, Goal), `description`, `tags`.
   284|**And** the file structure must support hundreds of entries without corruption.
   285|
   286|### Story 4.2: Implement "Brag Sheet" Generator
   287|
   288|As a User,
   289|I want to generate a list of my achievements for a specific period (e.g., "last 6 months"),
   290|So that I can prepare for my performance review.
   291|
   292|**Acceptance Criteria:**
   293|
   294|**Given** a request like "Gere minha brag sheet do último semestre",
   295|**When** the Coach agent runs,
   296|**Then** it should filter `career-log.json` entries by date range.
   297|**And** it should format the output as a Markdown list, grouped by category (Impact, Learning, Leadership).
   298|
   299|## Epic 5: Lifecycle Management
   300|Adicionar capacidades de arquivamento e gestão de ciclo de vida de projetos para manter a base de conhecimento limpa e performática.
   301|
   302|### Story 5.1: Implement Project Archiving
   303|
   304|As a User,
   305|I want to mark a project as "Archived" when it ends,
   306|So that it stops appearing in my active autocomplete and daily summaries.
   307|
   308|**Acceptance Criteria:**
   309|
   310|**Given** a project like "Vivo - Projeto Antigo",
   311|**When** I ask "Arquivar projeto Vivo - Projeto Antigo",
   312|**Then** the system should update the metadata in `status.json` setting `active: false` and `archivedAt: [Date]`.
   313|**And** it should move the folder to `/data/Archive/Clients/...` (Optional structure change) OR just filter it out of default queries.
   314|
   315|### Story 5.2: Implement Historical Search
   316|
   317|As a User,
   318|I want to be able to search for "Archived" projects if I need to retrieve an old decision,
   319|So that the knowledge isn't lost forever.
   320|
   321|**Acceptance Criteria:**
   322|
   323|**Given** a query explicitly asking for old projects (e.g., "O que fizemos no projeto X ano passado?"),
   324|**When** the Oracle searches,
   325|**Then** it should include files marked as `active: false`.
   326|**And** the response should indicate "[Archived Project]" clearly.
   327|
   328|## Epic 9: Agent-Script Integration
   329|Habilitar a execução automática de scripts de manutenção e relatório através da interface de chat da Freya.
   330|
   331|### Story 9.1: Implement Health Check & Maintenance Command Integration
   332|
   333|As a User,
   334|I want to ask Freya to "Check system health" or "Verify data integrity",
   335|So that she runs the `npm run health` script automatically and reports the results in the chat.
   336|
   337|**Acceptance Criteria:**
   338|1. **Given** a user request like "Verifique a integridade", "Health check" or "Meus dados estão ok?",
   339|2. **When** the agent processes the request,
   340|3. **Then** it should execute the command `npm run health` (or `node scripts/validate-data.js`).
   341|4. **And** it should capture the output and summarize it for the user (e.g., "Tudo ok, 3 arquivos verificados" or "Erro encontrado em X").
   342|5. **And** updates to `master.mdc` routing are required.
   343|
   344|### Story 9.2: Implement Reporting Command Integration (Weekly & Daily)
   345|
   346|As a User,
   347|I want to ask Freya to "Generate Weekly Report" or "Daily Summary",
   348|So that she runs the corresponding npm scripts and shows me the output/location immediately.
   349|
   350|**Acceptance Criteria:**
   351|1. **Given** a user request like "Gerar relatório semanal" or "Weekly report",
   352|2. **When** the agent processes the request,
   353|3. **Then** it should execute `npm run report`.
   354|4. **And** inform the user where the file was saved (and potentially read/show the content).
   355|5. **Given** a user request like "Gerar daily" or "Resumo diário",
   356|6. **When** the agent processes the request,
   357|7. **Then** it should execute `npm run daily`.
   358|8. **And** display the output (Ontem/Hoje/Bloqueios) directly in the chat.
   359|