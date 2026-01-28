# Guia do Usuário F.R.E.Y.A. v1.0

Bem-vindo à F.R.E.Y.A. (Fully Responsive Enhanced Yield Assistant).
Este sistema foi projetado para ser seu assistente pessoal de produtividade, operando diretamente no seu ambiente de desenvolvimento (IDE), com foco total em privacidade (Local-First) e eficiência.

## 🚀 Como Iniciar

Para interagir com a assistente, basta chamá-la no chat da sua IDE:

> `@freya [sua mensagem]`

A FREYA adotará uma persona calma, analítica e proativa para ajudá-lo.

---

## 📝 Funcionalidades Principais

### 1. Ingestão Universal (Logging)
Fale naturalmente. A FREYA entende contextos misturados e organiza tudo para você.

*   **Atualização de Projeto:**
    > "Reunião com o cliente Vivo, o projeto 5G vai atrasar por causa da chuva."
    *   *Resultado:* Atualiza `data/Clients/vivo/5g/status.json`.

*   **Registro de Carreira:**
    > "Recebi um feedback incrível do CTO sobre a apresentação de ontem."
    *   *Resultado:* Salva em `data/career/career-log.json` com a tag "Feedback".

*   **Blockers:**
    > "Estou travado na API de pagamento do Itaú."
    *   *Resultado:* Registra um blocker no projeto correspondente.

**Nota de Segurança:** Tudo o que você digita é salvo imediatamente em `logs/daily/YYYY-MM-DD.md` antes de qualquer processamento, garantindo que você nunca perca uma anotação.

### 2. O Oráculo (Consulta de Status)
Recupere o contexto de qualquer projeto instantaneamente.

*   **Status Rápido:**
    > "Como está o projeto Vivo 5G?"
    *   *Resultado:* Resumo executivo do status atual e das últimas 3 atualizações.

*   **Anti-Alucinação:**
    A FREYA sempre citará a fonte da informação (ex: `(Source: data/Clients/vivo/5g/status.json)`). Se ela não souber, ela dirá explicitamente.

### 3. Career Coach & Brag Sheets
Gerencie sua evolução profissional sem sair do editor.

*   **Gerar Brag Sheet:**
    > "Gere minha brag sheet do último semestre."
    *   *Resultado:* Uma lista formatada de suas conquistas, aprendizados e feedbacks, pronta para copiar e colar na sua autoavaliação.

### 4. Gestão de Ciclo de Vida (Arquivamento)
Mantenha seu foco limpo arquivando projetos antigos.

*   **Arquivar Projeto:**
    > "Arquivar o projeto Vivo Legado."
    *   *Resultado:* O projeto para de aparecer nas buscas diárias.

*   **Busca Histórica:**
    > "O que fizemos no projeto antigo da Vivo?"
    *   *Resultado:* A FREYA busca nos arquivos mortos (identificados com `[ARCHIVED]`).

### 5. Gestão de Tarefas
Organize seu dia-a-dia com um sistema de tarefas integrado.

*   **Criar Tarefa:**
    > "Lembre-me de revisar o PR #123 amanhã."
    *   *Resultado:* Cria uma nova tarefa pendente em `data/tasks/task-log.json`.

*   **Listar Tarefas:**
    > "Quais são minhas tarefas pendentes?"
    *   *Resultado:* Lista suas tarefas abertas, priorizando as urgentes (`DO_NOW`).

*   **Concluir Tarefa:**
    > "Terminei a revisão do PR #123."
    *   *Resultado:* Marca a tarefa como `COMPLETED` e registra a data de conclusão.

### 6. Relatórios Automatizados
Transforme seus logs em relatórios úteis sem esforço. Peça à FREYA no chat e ela executará os scripts para você.

*   **Relatório de Status Profissional (Executivo):**
    > "Gerar status report", "Relatório Executivo"
    *   *Resultado:* Gera um relatório Markdown completo com Resumo Executivo, Entregas, Status de Projetos e Bloqueios. Ideal para enviar stakeholders.
    *   *Manual:* `npm run status -- --period [daily|weekly]`

*   **Relatório Scrum Master (Semanal):**
    > "Gerar relatório SM" ou "Relatório Scrum Master"
    *   *Resultado:* Gera um report semanal focado em resumo, wins, blockers/riscos e foco da próxima semana.
    *   *Manual:* `npm run sm-weekly`

*   **Relatório de Blockers (priorizado por severidade):**
    > "Gerar relatório de blockers"
    *   *Resultado:* Lista blockers abertos ordenados por severidade e idade, pra ficar fácil priorizar.
    *   *Manual:* `npm run blockers`

*   **Relatório Semanal (Legado):**
    > "Gerar relatório semanal"
    *   *Resultado:* A FREYA executa o script e avisa onde o arquivo Markdown foi salvo em `docs/reports/`, exibindo um resumo.
    *   *Manual:* `npm run report`

*   **Resumo Daily (Legado):**
    > "Gerar daily" ou "Resumo diário"
    *   *Resultado:* A FREYA gera e exibe o texto "Ontem / Hoje / Bloqueios" diretamente no chat.
    *   *Manual:* `npm run daily`

### 7. Migração de Dados (schemaVersion)
Se você atualizou a FREYA e tem logs antigos, rode a migração para padronizar os JSONs.

*   **Migrar dados:**
    > `npm run migrate`
    *   *Resultado:* adiciona `schemaVersion` aos arquivos conhecidos (`task-log.json`, `career-log.json`, `blocker-log.json`).
    *   *Segurança:* se algum JSON estiver corrompido, ele é movido para quarentena (não é perdido).

### 8. Saúde do Sistema
Garanta que seus dados locais estão íntegros.

*   **Health Check:**
    > "Checar saúde do sistema" ou "Verificar integridade"
    *   *Resultado:* A FREYA roda o diagnóstico e reporta se todos os JSONs estão válidos ou se há erros para corrigir.
    *   *Manual:* `npm run health`

### 9. Git Automation
Deixe a Freya cuidar do versionamento básico do seu código.

*   **Auto-Commit:**
    > "Salvar alterações", "Gerar commit" ou "Commitar"
    *   *Resultado:* A Freya executa `git status`, analisa o `git diff` para entender o que mudou, gera uma mensagem de commit semântica e realiza o commit (`git add .` + `git commit`).
    *   *Nota:* Ela sempre pedirá confirmação ou avisará se não houver mudanças.

### 10. Detecção Implícita de Tarefas
A Freya agora entende suas intenções futuras sem precisar de comandos explícitos.

*   **Detecção Inteligente:**
    > "O projeto X atrasou porque *preciso configurar o servidor*."
    *   *Resultado:* A Freya cria automaticamente a tarefa "Configurar o servidor" e a vincula ao projeto X.
    *   *Palavras-chave:* "preciso", "tenho que", "falta", "vou", "pendente".

---

## 💡 Dicas de Uso

1.  **Seja Específico:** Mencionar o nome do Cliente ou Projeto ajuda a FREYA a categorizar corretamente.
2.  **Múltiplos Contextos:** Você pode misturar assuntos:
    > "O projeto Alpha está verde, mas preciso estudar Kubernetes para minha certificação."
    (Ela vai atualizar o projeto Alpha E adicionar uma meta de estudo no seu log de carreira).
3.  **Idioma:** A FREYA responde nativamente em **Português (Brasil)**. Se precisar de inglês, basta pedir: "Switch to English please".

---

## 📂 Onde estão meus dados?

Tudo fica no seu computador, dentro da pasta do projeto:
*   `data/Clients/`: Histórico dos projetos.
*   `data/career/`: Seu log de carreira.
*   `data/tasks/`: Seu log de tarefas.
*   `logs/daily/`: Log bruto diário (Markdown).
*   `docs/reports/`: Relatórios gerados.

---
*F.R.E.Y.A. — Assistente Responsiva com Otimização Aprimorada*
