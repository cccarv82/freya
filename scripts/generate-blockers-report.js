const fs = require('fs');
const path = require('path');

const { toIsoDate, safeParseToMs, isWithinRange } = require('./lib/date-utils');

const BLOCKERS_FILE = path.join(__dirname, '../data/blockers/blocker-log.json');
const REPORT_DIR = path.join(__dirname, '../docs/reports');

const SEVERITY_ORDER = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const RESOLVED_STATUSES = new Set(['RESOLVED', 'CLOSED', 'DONE', 'FIXED']);

function normalizeStatus(blocker) {
  const raw = blocker.status || blocker.state || blocker.currentStatus;
  if (!raw) return 'UNKNOWN';
  return String(raw).trim().toUpperCase();
}

function normalizeSeverity(blocker) {
  const raw = blocker.severity || blocker.priority || blocker.level;
  if (!raw) return 'UNSPECIFIED';
  const value = String(raw).trim().toUpperCase();
  if (value.includes('CRIT')) return 'CRITICAL';
  if (value.includes('HIGH')) return 'HIGH';
  if (value.includes('MED')) return 'MEDIUM';
  if (value.includes('LOW')) return 'LOW';
  return value;
}

function getCreatedAt(blocker) {
  const candidates = [
    blocker.createdAt,
    blocker.created_at,
    blocker.openedAt,
    blocker.opened_at,
    blocker.reportedAt,
    blocker.reported_at,
    blocker.date,
    blocker.loggedAt,
  ];
  for (const value of candidates) {
    const ms = safeParseToMs(value);
    if (Number.isFinite(ms)) return ms;
  }
  return NaN;
}

function getResolvedAt(blocker) {
  const candidates = [
    blocker.resolvedAt,
    blocker.resolved_at,
    blocker.closedAt,
    blocker.closed_at,
    blocker.completedAt,
  ];
  for (const value of candidates) {
    const ms = safeParseToMs(value);
    if (Number.isFinite(ms)) return ms;
  }
  return NaN;
}

function isOpen(blocker) {
  const status = normalizeStatus(blocker);
  if (RESOLVED_STATUSES.has(status)) return false;
  const resolvedAt = getResolvedAt(blocker);
  return !Number.isFinite(resolvedAt);
}

function getBlockerTitle(blocker) {
  return (
    blocker.title ||
    blocker.summary ||
    blocker.description ||
    blocker.content ||
    blocker.text ||
    'Untitled blocker'
  );
}

function formatAgeDays(createdMs, nowMs) {
  if (!Number.isFinite(createdMs)) return null;
  const ageMs = Math.max(0, nowMs - createdMs);
  return Math.floor(ageMs / (24 * 60 * 60 * 1000));
}

function ensureReportDir() {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

function loadBlockers() {
  if (!fs.existsSync(BLOCKERS_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(BLOCKERS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data.blockers) ? data.blockers : [];
  } catch (err) {
    console.error(`Error reading blockers file: ${err.message}`);
    return [];
  }
}

function generateReport() {
  const now = new Date();
  const nowMs = now.getTime();
  const reportDate = toIsoDate(now);
  const blockers = loadBlockers();

  const statusCounts = new Map();
  blockers.forEach(blocker => {
    const status = normalizeStatus(blocker);
    statusCounts.set(status, (statusCounts.get(status) || 0) + 1);
  });

  const openBlockers = blockers.filter(isOpen);
  openBlockers.sort((a, b) => {
    const severityA = normalizeSeverity(a);
    const severityB = normalizeSeverity(b);
    const rankA = SEVERITY_ORDER[severityA] ?? 99;
    const rankB = SEVERITY_ORDER[severityB] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    const ageA = getCreatedAt(a);
    const ageB = getCreatedAt(b);
    const msA = Number.isFinite(ageA) ? ageA : Number.MAX_SAFE_INTEGER;
    const msB = Number.isFinite(ageB) ? ageB : Number.MAX_SAFE_INTEGER;
    return msA - msB;
  });

  const sevenDaysAgo = new Date(nowMs - 7 * 24 * 60 * 60 * 1000);
  const resolvedRecent = blockers.filter(blocker => {
    const resolvedAt = getResolvedAt(blocker);
    if (!Number.isFinite(resolvedAt)) return false;
    return isWithinRange(resolvedAt, sevenDaysAgo, now);
  });
  resolvedRecent.sort((a, b) => {
    const msA = getResolvedAt(a);
    const msB = getResolvedAt(b);
    return msB - msA;
  });

  let report = `# Blockers Report - ${reportDate}\n\n`;
  report += '## Summary\n';
  report += `- Total blockers: ${blockers.length}\n`;
  if (statusCounts.size === 0) {
    report += '- Status counts: None\n\n';
  } else {
    report += '- Status counts:\n';
    const statuses = Array.from(statusCounts.keys()).sort();
    statuses.forEach(status => {
      report += `  - ${status}: ${statusCounts.get(status)}\n`;
    });
    report += '\n';
  }

  report += '## Open Blockers\n';
  if (openBlockers.length === 0) {
    report += 'None.\n\n';
  } else {
    openBlockers.forEach(blocker => {
      const title = getBlockerTitle(blocker);
      const status = normalizeStatus(blocker);
      const severity = normalizeSeverity(blocker);
      const createdMs = getCreatedAt(blocker);
      const createdDate = Number.isFinite(createdMs) ? toIsoDate(createdMs) : 'Unknown';
      const ageDays = formatAgeDays(createdMs, nowMs);
      const project = blocker.project || blocker.projectName || blocker.projectSlug;
      const client = blocker.client || blocker.clientName || blocker.clientSlug;
      const metaParts = [
        `Status: ${status}`,
        project ? `Project: ${project}` : null,
        client ? `Client: ${client}` : null,
        `Created: ${createdDate}`,
        ageDays === null ? null : `Age: ${ageDays}d`,
      ].filter(Boolean);
      report += `- [${severity}] ${title} (${metaParts.join('; ')})\n`;
    });
    report += '\n';
  }

  report += '## Resolved Blockers (Last 7 Days)\n';
  if (resolvedRecent.length === 0) {
    report += 'None.\n';
  } else {
    resolvedRecent.forEach(blocker => {
      const title = getBlockerTitle(blocker);
      const severity = normalizeSeverity(blocker);
      const resolvedMs = getResolvedAt(blocker);
      const resolvedDate = Number.isFinite(resolvedMs) ? toIsoDate(resolvedMs) : 'Unknown';
      const project = blocker.project || blocker.projectName || blocker.projectSlug;
      const client = blocker.client || blocker.clientName || blocker.clientSlug;
      const metaParts = [
        project ? `Project: ${project}` : null,
        client ? `Client: ${client}` : null,
        `Resolved: ${resolvedDate}`,
      ].filter(Boolean);
      report += `- [${severity}] ${title} (${metaParts.join('; ')})\n`;
    });
  }

  ensureReportDir();
  const outputPath = path.join(REPORT_DIR, `blockers-${reportDate}.md`);
  fs.writeFileSync(outputPath, report);
  console.log(report);
}

generateReport();
