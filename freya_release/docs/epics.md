
### Epic 10: Git Automation
Implementar integração com Git para permitir que a Freya realize commits e outras operações básicas de controle de versão através de comandos em linguagem natural.

### Story 10.1: Implement Auto-Commit Command

As a User,
I want to ask Freya to "Generate a commit" or "Save my changes",
So that she automatically stages files, generates a friendly commit message, and commits the changes without me needing to use the terminal.

**Acceptance Criteria:**

1. **Given** a user request like "Gere um commit", "Salvar alterações" or "Commitar",
2. **When** the agent processes the request,
3. **Then** it should execute `git status` to check for changes.
4. **And** if there are changes, it should execute `git diff` to understand what changed.
5. **And** it should generate a concise, friendly commit message describing the changes.
6. **And** it should execute `git add .` and `git commit -m "message"`.
7. **And** it should confirm the commit to the user.
