---
stepsCompleted:
  - 1
  - 2
  - 3
  - 4
  - 5
inputDocuments:
  - docs/analysis/research/technical-local-persistence-research-2025-12-12.md
  - docs/analysis/brainstorming-session-2025-12-12.md
workflowType: 'product-brief'
lastStep: 1
project_name: 'freya'
user_name: 'Carlos'
date: '2025-12-12'
---

# Product Brief: freya

**Date:** 2025-12-12
**Author:** Carlos

---

## Executive Summary

F.R.E.Y.A. (Fully Responsive Enhanced Yield Assistant) is an AI-powered Executive Assistant integrated directly into the IDE, designed specifically for high-performance Scrum Masters operating in complex, multi-client enterprise environments. Unlike generic AI tools that offer broad assistance, FREYA specializes in "Chaos In, Order Out"—transforming unstructured daily inputs (meetings, blockers, career goals) into a rigorously structured, local-first knowledge base. She acts as an external executive brain: preventing information loss, automating the taxonomy of project data, and providing instant, oracle-like recall for status reporting and career advancement strategies. Built on a Local-First architecture with JSON structured storage, FREYA ensures total data privacy, integrity, and availability, empowering the user to operate at an elite level of efficiency and strategic insight.

---

## Core Vision

### Problem Statement
Enterprise Scrum Masters managing multiple critical projects (e.g., Vivo+) face an overwhelming volume of fragmented information daily. The cognitive load of capturing, organizing, and retrieving context across different clients, streams, and career goals leads to **critical information loss** and confusion. The primary pain point is not just the time spent organizing, but the anxiety and risk associated with losing details or mixing up contexts in high-stakes environments.

### Problem Impact
- **Information Loss:** Critical details from meetings or blockers are forgotten or misfiled, leading to inaccurate reporting.
- **Context Switching Cost:** Mental energy is wasted trying to recall "what happened in project X last week" instead of focusing on strategy.
- **Career Stagnation:** Without structured tracking of achievements and goals, professional growth becomes reactive rather than strategic.
- **Reputational Risk:** Inability to provide immediate, accurate answers to executive stakeholders damages credibility.

### Why Existing Solutions Fall Short
- **Generic AI (ChatGPT/Claude):** Lack persistent memory and specific context of the user's complex hierarchy (Client > Project > Stream).
- **Project Tools (Jira/ADO):** Too rigid for "brain dumps" and don't manage personal career context or informal blockers effectively.
- **Note Apps (OneNote/Notion):** Require manual organization and tagging; they don't "act" or "process" data intelligently.

### Proposed Solution
FREYA is a **Local-First AI Agent** residing in the IDE (Cursor/VSCode) that:
1.  **Ingests Chaos:** Accepts unstructured text dumps (natural language logs) covering any topic.
2.  **Structuring Engine:** Automatically parses, tags, and stores data into a hierarchical JSON database (Client > Project > Stream).
3.  **Oracle Recall:** Provides instant, context-aware answers for status reports and historical queries (even from a year ago).
4.  **Career Coach:** Actively manages the user's career trajectory, leveraging historical data to suggest strategic moves for advancement.

### Key Differentiators
- **"My Brain, Organized":** Acts as a seamless extension of the user's cognition, specifically tuned for the Scrum Master role.
- **Local-First & Private:** All data lives on the user's machine in structured JSON; zero risk of data leakage or cloud dependency.
- **Domain Expert Persona:** FREYA is not just a librarian; she is the "Best Scrum Master in the Universe," coaching the user towards high performance.
- **Hybrid Interaction:** Chat-driven for speed ("Oracle Mode") with file generation only on demand, preventing digital clutter.

---

## Target Users

### Primary Users
**Carlos, The High-Performance Enterprise Scrum Master**
- **Role:** Scrum Master at Accenture (Big Tech) working for Vivo (Telecom).
- **Context:** High-pressure environment, multiple projects (Vivo+), direct exposure to C-level executives.
- **Goals:** Deliver flawless execution, manage complex dependencies, and advance career to elite levels.
- **Pain Points:** Information overload, fear of dropping balls, cognitive fatigue from context switching.
- **Needs:** A "second brain" that is faster, more organized, and never forgets.

### Secondary Users
**Indirect Stakeholders (Consumers of Output)**
- **Executive Leadership (Vivo/Accenture):** Require accurate, concise, and timely status reports. They judge Carlos based on the quality of FREYA's output.
- **Career Counselors:** Require evidence of achievements and goal progression for performance reviews.

### User Journey
1.  **Ingestion (The Dump):** Carlos opens VSCode/Cursor, selects the FREYA agent + Instructions file, and dictates/types a raw update ("Meeting with team X, blocker on Y...").
2.  **Processing (The Black Box):** FREYA silently parses this text, identifies entities (Client: Vivo, Project: Vivo+, Stream: XPTO), and updates the structured JSON database.
3.  **Recall (The Oracle):** Later, Carlos asks: "Status update for XPTO?". FREYA queries the JSONs and generates a precise summary in the chat.
4.  **Action (The Deliverable):** Carlos reviews the summary and sends it to stakeholders, saving hours of manual compilation.

---

## Success Metrics

### User Success Metrics
**"The Preparedness Factor"**
- **Meeting Readiness:** Ability to generate a complete context briefing ("Prepare me for the Vivo+ meeting") in < 30 seconds with 100% accuracy on historical context.
- **Long-Term Recall:** Successful retrieval of granular details from closed projects (> 1 year ago) without manual digging.
- **Confidence Level:** Subjective reduction in anxiety regarding "dropped balls" or forgotten details.

### Business Objectives
**"Elite Execution & Growth"**
- **Stakeholder Satisfaction:** Positive feedback on the clarity, speed, and accuracy of status reports and answers.
- **Career Velocity:** Measurable progress in career goals (certifications, promotions) tracked and nudged by FREYA.
- **Operational Efficiency:** Reduction in time spent compiling manual reports, freeing up time for strategic problem solving.

### Key Performance Indicators (KPIs)
- **Recall Accuracy:** % of queries where FREYA provides the correct answer immediately without hallucination.
- **Ingestion Success:** % of unstructured "dumps" correctly parsed into the right Project/Stream JSON buckets.
- **Response Time:** Time to generate a complex status report (Target: < 1 minute).

---

## MVP Scope

### Core Features
1.  **Native Chat Integration:** Zero-UI approach; utilizes existing VSCode/Cursor chat interface for all interactions. No custom GUI to build or maintain.
2.  **Unstructured Ingestion Engine:** Ability to parse mixed-context natural language dumps (Project + Career + Blockers in one message) and route data to correct JSON stores.
3.  **Local Knowledge Base:** Automated creation and management of hierarchical JSON structure (Client > Project > Stream) and Career Logs.
4.  **Career & Promotion Coach:** Specialized module for tracking achievements, certifications, and feedback against career progression goals (Accenture specific nuances).
5.  **Oracle Query System:** Context-aware retrieval that synthesizes answers from the local JSON base without hallucination.

### Out of Scope for MVP
- **External Integrations:** No direct connection to Jira, Workday, or Azure DevOps APIs (security/compliance risk mitigation).
- **Web Dashboards:** No standalone web interface or visual analytics panels. Interaction is strictly text-based.
- **Cloud Sync:** No cloud database or multi-device sync logic (strictly Local-First).

### MVP Success Criteria
- **"The Friday Test":** Can Carlos generate his end-of-week status report in under 2 minutes using only FREYA's memory of the week's dumps?
- **Career Alignment:** Does FREYA correctly suggest a next step or highlight a gap based on the user's career log inputs?
- **Data Integrity:** Zero loss of information from input dump to JSON storage.

### Future Vision
- **Advanced RAG:** Vector search for semantic understanding of long-term history ("What was the tone of meetings last year?").
- **Proactive Nudging:** FREYA initiating conversations ("You haven't updated your career goals in 2 weeks").
- **Multi-Device Support:** Secure sync to mobile for on-the-go updates (eventually).
