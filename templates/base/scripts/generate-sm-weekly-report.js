const fs = require('fs');
const path = require('path');

const { toIsoDate, safeParseToMs, isWithinRange } = require('./lib/date-utils');
const { safeReadJson, quarantineCorruptedFile } = require('./lib/fs-utils');

const DATA_DIR = path.join(__dirname, '../data');
const REPORT_DIR = path.join(__dirname, '../docs/reports');

const TASKS_FILE = path.join(DATA_DIR, 'tasks/task-log.json');
const BLOCKERS_FILE = path.join(DATA_DIR, 'blockers/blocker-log.json');
const CLIENTS_DIR = path.join(DATA_DIR, 'Clients');

const SEV_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJsonOrQuarantine(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const res = safeReadJson(filePath);
  if (!res.ok) {
    if (res.error.type === 'parse') {
      quarantineCorruptedFile(filePath, res.error.message);
      console.warn(`⚠️ JSON parse failed; quarantined: ${filePath}`);
    } else {
      console.warn(`⚠️ JSON read failed: ${filePath}: ${res.error.message}`);
    }
    return fallback;
  }
  return res.json;
}

function daysBetweenMs(aMs, bMs) {
  const diff = Math.max(0, bMs - aMs);
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

function scanProjectStatusFiles() {
  const results = [];
  if (!fs.existsSync(CLIENTS_DIR)) return results;

  const clients = fs.readdirSync(CLIENTS_DIR);
  for (const clientSlug of clients) {
    const clientPath = path.join(CLIENTS_DIR, clientSlug);
    if (!fs.statSync(clientPath).isDirectory()) continue;

    const projects = fs.readdirSync(clientPath);
    for (const projectSlug of projects) {
      const projectPath = path.join(clientPath, projectSlug);
      if (!fs.statSync(projectPath).isDirectory()) continue;

      const statusPath = path.join(projectPath, 'status.json');
      if (fs.existsSync(statusPath)) results.push(statusPath);
    }
  }
  return results;
}

function generate() {
  ensureDir(REPORT_DIR);

  const now = new Date();
  const end = now;
  const start = new Date(now);
  start.setDate(now.getDate() - 7);

  const reportDate = toIsoDate(now);

  const taskLog = readJsonOrQuarantine(TASKS_FILE, { schemaVersion: 1, tasks: [] });
  const blockersLog = readJsonOrQuarantine(BLOCKERS_FILE, { schemaVersion: 1, blockers: [] });

  const tasks = taskLog.tasks || [];
  const blockers = blockersLog.blockers || [];

  const completedTasks = tasks.filter(t => {
    if (t.status !== 'COMPLETED') return false;
    return isWithinRange(t.completedAt || t.completed_at, start, end);
  });

  const pendingDoNow = tasks.filter(t => t.status === 'PENDING' && t.category === 'DO_NOW');

  const activeBlockers = blockers.filter(b => {
    const st = String(b.status || '').toUpperCase();
    return st === 'OPEN' || st === 'MITIGATING';
  });

  activeBlockers.sort((a, b) => {
    const sa = SEV_ORDER[String(a.severity || '').toUpperCase()] ?? 99;
    const sb = SEV_ORDER[String(b.severity || '').toUpperCase()] ?? 99;
    if (sa !== sb) return sa - sb;
    const ta = safeParseToMs(a.createdAt) || 0;
    const tb = safeParseToMs(b.createdAt) || 0;
    return ta - tb; // older first
  });

  const upcomingDueBlockers = blockers.filter(b => {
    const st = String(b.status || '').toUpperCase();
    if (st !== 'OPEN') return false;
    if (!b.dueDate) return false;
    // dueDate is an ISO date; treat as UTC midnight
    const dueMs = safeParseToMs(String(b.dueDate));
    if (!Number.isFinite(dueMs)) return false;
    const due = new Date(dueMs);
    const soonEnd = new Date(now);
    soonEnd.setDate(now.getDate() + 7);
    return due >= now && due <= soonEnd;
  });

  // Projects
  const statusFiles = scanProjectStatusFiles();
  const projectsWithUpdates = [];

  for (const statusPath of statusFiles) {
    const proj = readJsonOrQuarantine(statusPath, null);
    if (!proj) continue;

    const history = Array.isArray(proj.history) ? proj.history : [];
    const recent = history.filter(h => isWithinRange(h.date || h.timestamp, start, end));
    if (recent.length === 0) continue;

    projectsWithUpdates.push({
      client: proj.client || path.basename(path.dirname(path.dirname(statusPath))),
      project: proj.project || path.basename(path.dirname(statusPath)),
      currentStatus: proj.currentStatus,
      recent
    });
  }

  // Markdown
  let md = `# Scrum Master Weekly Report — ${reportDate}\n`;
  md += `**Período:** ${toIsoDate(start)} a ${toIsoDate(end)}\n\n`;

  md += `## Summary\n`;
  md += `- Completed tasks (7d): **${completedTasks.length}**\n`;
  md += `- Active blockers (OPEN/MITIGATING): **${activeBlockers.length}**\n`;
  md += `- Projects updated (7d): **${projectsWithUpdates.length}**\n\n`;

  md += `## Wins\n`;
  if (completedTasks.length === 0) {
    md += `No completed tasks recorded in the last 7 days.\n\n`;
  } else {
    completedTasks.forEach(t => {
      md += `- ${t.description}\n`;
    });
    md += `\n`;
  }

  md += `## Blockers & Risks\n`;
  if (activeBlockers.length === 0) {
    md += `None.\n\n`;
  } else {
    activeBlockers.forEach(b => {
      const createdMs = safeParseToMs(b.createdAt) || Date.now();
      const agingDays = daysBetweenMs(createdMs, Date.now());
      const sev = String(b.severity || '').toUpperCase();
      const st = String(b.status || '').toUpperCase();
      const owner = b.owner ? `; owner: ${b.owner}` : '';
      const proj = b.projectSlug ? `; project: ${b.projectSlug}` : '';
      const next = b.nextAction ? `; next: ${b.nextAction}` : '';
      md += `- [${sev}/${st}] ${b.title} (aging: ${agingDays}d${owner}${proj}${next})\n`;
    });
    md += `\n`;
  }

  md += `## Project Updates\n`;
  if (projectsWithUpdates.length === 0) {
    md += `No project updates found in the last 7 days.\n\n`;
  } else {
    projectsWithUpdates.forEach(p => {
      md += `### ${p.client} / ${p.project}\n`;
      if (p.currentStatus) md += `**Status:** ${p.currentStatus}\n`;
      p.recent.forEach(e => {
        md += `- [${e.date || e.timestamp}] ${e.content || ''}\n`;
      });
      md += `\n`;
    });
  }

  md += `## Next Week Focus\n`;
  if (pendingDoNow.length === 0 && upcomingDueBlockers.length === 0) {
    md += `No DO_NOW tasks or due-soon blockers found.\n`;
  } else {
    if (pendingDoNow.length > 0) {
      md += `### DO_NOW Tasks\n`;
      pendingDoNow.forEach(t => {
        md += `- [ ] ${t.description}\n`;
      });
      md += `\n`;
    }
    if (upcomingDueBlockers.length > 0) {
      md += `### Blockers due soon (next 7 days)\n`;
      upcomingDueBlockers.forEach(b => {
        md += `- [${String(b.severity || '').toUpperCase()}] ${b.title} (due: ${b.dueDate})\n`;
      });
      md += `\n`;
    }
  }

  const outPath = path.join(REPORT_DIR, `sm-weekly-${reportDate}.md`);
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(md);
  console.log(`\nSaved: ${outPath}`);
}

generate();
