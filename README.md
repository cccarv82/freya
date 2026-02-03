# F.R.E.Y.A. - Fully Responsive Enhanced Yield Assistant

> **Sua Assistente de Produtividade Local-First no navegador.**

F.R.E.Y.A. é um sistema de agentes de IA projetado para organizar seu trabalho, gerenciar status de projetos, rastrear tarefas e registrar sua evolução de carreira, tudo através de uma interface web local no navegador.

## 🌟 Principais Recursos

*   **Web local (apenas navegador):** Acesso 100% via UI web local, sem app desktop e sem cloud.
*   **Ingestão Universal:** Registre updates, blockers e notas mentais em linguagem natural.
*   **Gestão de Tarefas:** Crie, liste e conclua tarefas ("Lembre-me de fazer X", "Minhas tarefas", "Terminei X").
*   **Timeline + Projetos:** Linha do tempo com filtros por tag, projeto e tipo, além de listagem de projetos.
*   **Companion Panels:** Painel rápido com qualidade de log, resumo executivo, anomalias e resumo de risco.
*   **Incident Radar:** Card de incidentes com status e ação de “marcar resolvido”.
*   **Task Heatmap:** Visão por projeto com prioridade, contadores e link direto para status.
*   **Relatórios Automatizados:** Gere resumos semanais, dailies, relatório de Scrum Master e relatórios executivos.
*   **Oráculo:** Pergunte sobre o status de qualquer projeto ("Como está o projeto X?") e recupere logs diários ("O que anotei ontem?").
*   **Career Coach:** Gere "Brag Sheets" automáticas para suas avaliações de desempenho.
*   **Links Bidirecionais:** Auto-link entre notas, tarefas e projetos (compatível com Obsidian).
*   **Saúde do Sistema:** Valide a integridade dos seus dados locais com um comando.
*   **Git Automation:** Gere commits inteligentes automaticamente. A Freya analisa suas mudanças e escreve a mensagem para você.
*   **Privacidade Total:** Seus dados (JSON e Markdown) ficam 100% locais na sua máquina.

## 📦 Instalação (Web UI)

FREYA web

A FREYA roda como um app web local. Basta iniciar o servidor e abrir o navegador.

```bash
npx @cccarv82/freya@latest --no-open --port 3872
```

## 🚢 Publicação no npm (maintainers)

Este repositório suporta publicação automática via GitHub Actions.

### Pré-requisitos
1) Ter permissão de publish no pacote `@cccarv82/freya` no npm.
2) Criar o secret no GitHub: `NPM_TOKEN` (Automation token do npm com permissão de publish).

### Como publicar
1) Atualize a versão e crie uma tag `vX.Y.Z`:
```bash
npm version patch
# ou minor/major

git push --follow-tags
```
2) A Action `npm-publish` roda no push da tag e executa `npm publish --access public`.

### Via npx (recomendado)
```bash
npx @cccarv82/freya
```

### Via instalação global
```bash
npm i -g @cccarv82/freya
freya
```

### Opções úteis
```bash
freya --port 4000       # muda a porta (padrão: 3872)
freya --dir ./freya     # define a workspace local (padrão: ./freya)
freya --no-open         # não abre o navegador automaticamente
freya --dev             # cria dados demo em workspace vazia
```

## 🚀 Como Usar

1.  Inicie o servidor com `npx @cccarv82/freya` ou `freya`.
2.  O navegador abre em `http://127.0.0.1:3872` (porta padrão).
3.  Se a workspace não existir, a própria UI faz o **auto-init** usando apenas arquivos locais.

### Comandos Rápidos
Você pode pedir para a FREYA executar estas tarefas diretamente na UI, ou rodar via terminal dentro da workspace:

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
