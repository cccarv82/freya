# F.R.E.Y.A. - Fully Responsive Enhanced Yield Assistant

> **Sua Assistente de Produtividade Local-First para sua IDE.**

F.R.E.Y.A. é um sistema de agentes de IA projetado para organizar seu trabalho, gerenciar status de projetos, rastrear tarefas e registrar sua evolução de carreira, tudo através de uma interface de chat simples e direta.

## 🌟 Principais Recursos

*   **Ingestão Universal:** Registre updates, blockers e notas mentais em linguagem natural.
*   **Gestão de Tarefas:** Crie, liste e conclua tarefas ("Lembre-me de fazer X", "Minhas tarefas", "Terminei X").
*   **Oráculo:** Pergunte sobre o status de qualquer projeto ("Como está o projeto X?").
*   **Career Coach:** Gere "Brag Sheets" automáticas para suas avaliações de desempenho.
*   **Relatórios Automatizados:** Gere resumos semanais, dailies, relatório de Scrum Master e relatórios executivos.
*   **Blockers & Riscos:** Gere um relatório rápido de blockers priorizados por severidade.
*   **Saúde do Sistema:** Valide a integridade dos seus dados locais com um comando.
*   **Git Automation:** Gere commits inteligentes automaticamente. A Freya analisa suas mudanças e escreve a mensagem para você.
*   **Privacidade Total:** Seus dados (JSON e Markdown) ficam 100% locais na sua máquina.

## 📦 Instalação (CLI)

Você pode usar a FREYA como um CLI para **inicializar uma workspace** completa (agents + scripts + data) em qualquer diretório.

### Via npx (recomendado)
```bash
npx @cccarv82/freya init
# cria ./freya
```

### Via instalação global
```bash
npm i -g @cccarv82/freya
freya init
# cria ./freya
```

### Modos do `init`
```bash
freya init              # cria ./freya
freya init meu-projeto  # cria ./meu-projeto
freya init --here       # instala no diretório atual
```

## 🚀 Como Usar

1.  Abra a pasta da workspace gerada (ex.: `./freya`) na **sua IDE**.
2.  No chat da IDE (ex: Ctrl+L / Cmd+L), digite:
    > `@freya Ajuda`
3.  Siga as instruções da assistente.

### Comandos Rápidos
Você pode pedir para a FREYA executar estas tarefas diretamente no chat, ou rodar via terminal:

*   **Checar integridade:** "Verifique a saúde do sistema" (ou `npm run health`)
*   **Migrar dados (se necessário):** `npm run migrate` (adiciona `schemaVersion` em logs antigos)
*   **Relatório Profissional (Executivo):** "Gere o status report" (ou `npm run status`)
*   **Relatório Scrum Master (semanal):** `npm run sm-weekly`
*   **Relatório de blockers:** `npm run blockers`
*   **Relatório semanal (legado):** "Gere o relatório semanal" (ou `npm run report`)
*   **Resumo daily (legado):** "Gere o daily" (ou `npm run daily`)

## 📘 Documentação Completa

Para um guia detalhado de comandos e exemplos, consulte o **[Guia do Usuário](USER_GUIDE.md)** incluído nesta pasta.

## Estrutura de Pastas

*   `.agent/`: O "cérebro" da IA (Regras e Personas).
*   `data/`: O "banco de dados" (JSONs dos seus projetos, tarefas e carreira).
*   `logs/`: O "diário" (Histórico bruto de tudo que você digitou).
*   `docs/reports/`: Relatórios gerados automaticamente.
*   `scripts/`: Ferramentas de automação e validação.

---
*F.R.E.Y.A. v1.0 - Release 2025-12-13*
