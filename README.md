# F.R.E.Y.A. - Fully Responsive Enhanced Yield Assistant

> **Sua Assistente de Produtividade Local-First para sua IDE.**

F.R.E.Y.A. é um sistema de agentes de IA projetado para organizar seu trabalho, gerenciar status de projetos, rastrear tarefas e registrar sua evolução de carreira, tudo através de uma interface de chat simples e direta.

## 🌟 Principais Recursos

*   **Ingestão Universal:** Registre updates, blockers e notas mentais em linguagem natural.
*   **Gestão de Tarefas:** Crie, liste e conclua tarefas ("Lembre-me de fazer X", "Minhas tarefas", "Terminei X").
*   **Oráculo:** Pergunte sobre o status de qualquer projeto ("Como está o projeto X?").
*   **Career Coach:** Gere "Brag Sheets" automáticas para suas avaliações de desempenho.
*   **Relatórios Automatizados:** Gere resumos semanais ou dailies instantâneos.
*   **Saúde do Sistema:** Valide a integridade dos seus dados locais com um comando.
*   **Privacidade Total:** Seus dados (JSON e Markdown) ficam 100% locais na sua máquina.

## 🚀 Como Usar

1.  Abra esta pasta na **sua IDE**.
2.  No chat da IDE (ex: Ctrl+L / Cmd+L), digite:
    > `@freya Ajuda`
3.  Siga as instruções da assistente.

### Comandos Rápidos
Você pode pedir para a FREYA executar estas tarefas diretamente no chat, ou rodar via terminal:

*   **Checar integridade:** "Verifique a saúde do sistema" (ou `npm run health`)
*   **Relatório semanal:** "Gere o relatório semanal" (ou `npm run report`)
*   **Resumo daily:** "Gere o daily" (ou `npm run daily`)

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
