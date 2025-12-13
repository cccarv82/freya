# F.R.E.Y.A. Data Schemas

This document defines the JSON structure for the local knowledge base.

## Career Log (`data/career/career-log.json`)

Stores professional achievements, feedback, and certifications.

```json
{
  "entries": [
    {
      "id": "uuid-v4",
      "date": "YYYY-MM-DD",
      "type": "Achievement" | "Feedback" | "Certification" | "Goal",
      "description": "Text description of the item.",
      "tags": ["tag1", "tag2"],
      "source": "Optional origin (e.g. 'Meeting with X')"
    }
  ]
}
```

## Project Status (`data/Clients/{client_slug}/{project_slug}/status.json`)

Stores the ongoing status and history of a project.

```json
{
  "client": "String (Display Name, e.g., 'Vivo')",
  "project": "String (Display Name, e.g., '5G')",
  "active": true,
  "archivedAt": "YYYY-MM-DD (Optional, present if active=false)",
  "currentStatus": "String (Latest status summary)",
  "lastUpdated": "YYYY-MM-DD",
  "history": [
    {
      "date": "YYYY-MM-DD",
      "type": "Status" | "Decision" | "Risk" | "Blocker",
      "content": "String (The update details)",
      "tags": ["String"]
    }
  ]
}
```

## Task Log (`data/tasks/task-log.json`)

Centralized storage for personal tasks and to-dos.

```json
{
  "tasks": [
    {
      "id": "String (UUID or timestamp-slug)",
      "description": "String",
      "category": "DO_NOW" | "SCHEDULE" | "DELEGATE" | "IGNORE",
      "status": "PENDING" | "COMPLETED" | "ARCHIVED",
      "createdAt": "YYYY-MM-DDTHH:mm:ssZ",
      "completedAt": "YYYY-MM-DDTHH:mm:ssZ (Optional)",
      "projectSlug": "String (Optional, link to project)",
      "priority": "high" | "medium" | "low" (Optional)
    }
  ]
}
```
