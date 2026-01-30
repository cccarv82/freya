/**
 * generate-executive-report.js
 * Generates a professional Markdown status report (Daily/Weekly)
 * aggregating Tasks, Project Updates, and Daily Logs.
 * 
 * Usage: node scripts/generate-executive-report.js --period [daily|weekly]
 */

const fs = require('fs');
const path = require('path');

const { toIsoDate, isWithinRange, safeParseToMs } = require('./lib/date-utils');
const { safeReadJson, quarantineCorruptedFile } = require('./lib/fs-utils');

// --- Configuration ---
const DATA_DIR = path.join(__dirname, '../data');
const LOGS_DIR = path.join(__dirname, '../logs/daily');
const OUTPUT_DIR = path.join(__dirname, '../docs/reports');
const TASKS_FILE = path.join(DATA_DIR, 'tasks/task-log.json');
const BLOCKERS_FILE = path.join(DATA_DIR, 'blockers/blocker-log.json');

const RESOLVED_STATUSES = new Set(['RESOLVED', 'CLOSED', 'DONE', 'FIXED']);
const SEVERITY_ORDER = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3
};

// --- Helpers ---
function getDateRange(period) {
    const today = new Date();
    const end = new Date(today);
    const start = new Date(today);

    if (period === 'weekly') {
        // Last 7 days
        start.setDate(today.getDate() - 7);
    } else {
        // Daily: Start of today (00:00 local time) to now.
        start.setHours(0, 0, 0, 0);
    }
    return { start, end };
}

function formatDate(date) {
    return toIsoDate(date);
}

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// --- Data Fetching ---

function getTasks(start, end) {
    if (!fs.existsSync(TASKS_FILE)) return { completed: [], pending: [], blockers: [] };
    
    const result = safeReadJson(TASKS_FILE);
    if (!result.ok) {
        const relativePath = path.relative(DATA_DIR, TASKS_FILE);
        if (result.error.type === 'parse') {
            quarantineCorruptedFile(TASKS_FILE, result.error.message);
            console.warn(`⚠️ [${relativePath}] JSON parse failed; quarantined to _corrupted.`);
        } else {
            console.error(`Error reading tasks: ${result.error.message}`);
        }
        return { completed: [], pending: [] };
    }

    const tasks = result.json.tasks || [];

    const completed = tasks.filter(t => {
        if (t.status !== 'COMPLETED' || !t.completedAt) return false;
        return isWithinRange(t.completedAt, start, end);
    });

    const pending = tasks.filter(t => t.status === 'PENDING' && t.category === 'DO_NOW');
    
    // "Blockers" could be tasks tagged as such or implicit in status? 
    // For now, we don't have explicit blocker task type, but we can look for high priority or specific keywords if we wanted.
    // Let's stick to simple PENDING DO_NOW for Next Steps.
    
    return { completed, pending };
}

function getProjectUpdates(start, end) {
    const clientsDir = path.join(DATA_DIR, 'Clients');
    if (!fs.existsSync(clientsDir)) return [];

    const updates = [];

    function scan(dir) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory()) {
                if (file === '_corrupted') {
                    continue;
                }
                scan(fullPath);
            } else if (file === 'status.json') {
                const result = safeReadJson(fullPath);
                if (!result.ok) {
                    const relativePath = path.relative(DATA_DIR, fullPath);
                    if (result.error.type === 'parse') {
                        quarantineCorruptedFile(fullPath, result.error.message);
                        console.warn(`⚠️ [${relativePath}] JSON parse failed; quarantined to _corrupted.`);
                    } else {
                        console.error(`Error reading ${relativePath}: ${result.error.message}`);
                    }
                    continue;
                }

                const project = result.json;
                
                // Filter history
                const recentEvents = (project.history || []).filter(h => {
                    return isWithinRange(h.date || h.timestamp, start, end); // Support both formats if they vary
                });

                if (recentEvents.length > 0 || project.currentStatus) {
                    updates.push({
                        name: project.project || path.basename(path.dirname(fullPath)),
                        client: project.client || path.basename(path.dirname(path.dirname(fullPath))),
                        status: project.currentStatus,
                        events: recentEvents
                    });
                }
            }
        }
    }

    scan(clientsDir);
    return updates;
}

function getDailyLogs(start, end) {
    if (!fs.existsSync(LOGS_DIR)) return [];

    const relevantLogs = [];
    const files = fs.readdirSync(LOGS_DIR);

    for (const file of files) {
        if (!file.endsWith('.md')) continue;
        const dateStr = file.replace('.md', '');
        // The filenames are YYYY-MM-DD. Compare as ISO dates to avoid timezone parsing drift.
        const startIso = formatDate(start);
        const endIso = formatDate(end);
        if (dateStr >= startIso && dateStr <= endIso) {
            try {
                const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf8');
                relevantLogs.push({ date: dateStr, content });
            } catch (e) {}
        }
    }
    return relevantLogs;
}

function summarizeLogContent(content, maxLines = 3, maxChars = 280) {
    if (!content) return null;
    const lines = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));

    const highlights = [];
    for (const line of lines) {
        const cleaned = line.replace(/^[-*]\s+/, '').replace(/^>\s+/, '').trim();
        if (!cleaned) continue;
        highlights.push(cleaned);
        if (highlights.length >= maxLines) break;
    }

    if (highlights.length === 0) return null;
    let summary = highlights.join('; ');
    if (summary.length > maxChars) {
        summary = summary.slice(0, Math.max(0, maxChars - 3)).trim() + '...';
    }
    return summary;
}

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

function getCreatedAt(blocker) {
    const candidates = [
        blocker.createdAt,
        blocker.created_at,
        blocker.openedAt,
        blocker.opened_at,
        blocker.reportedAt,
        blocker.reported_at,
        blocker.date,
        blocker.loggedAt
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
        blocker.completedAt
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

function loadBlockers() {
    if (!fs.existsSync(BLOCKERS_FILE)) return [];
    const result = safeReadJson(BLOCKERS_FILE);
    if (!result.ok) {
        const relativePath = path.relative(DATA_DIR, BLOCKERS_FILE);
        if (result.error.type === 'parse') {
            quarantineCorruptedFile(BLOCKERS_FILE, result.error.message);
            console.warn(`⚠️ [${relativePath}] JSON parse failed; quarantined to _corrupted.`);
        } else {
            console.error(`Error reading blockers: ${result.error.message}`);
        }
        return [];
    }
    return Array.isArray(result.json.blockers) ? result.json.blockers : [];
}

function getBlockers(start, end) {
    const blockers = loadBlockers();
    const open = blockers.filter(isOpen);
    open.sort((a, b) => {
        const severityA = normalizeSeverity(a);
        const severityB = normalizeSeverity(b);
        const rankA = SEVERITY_ORDER[severityA] ?? 99;
        const rankB = SEVERITY_ORDER[severityB] ?? 99;
        if (rankA !== rankB) return rankA - rankB;
        const createdA = getCreatedAt(a);
        const createdB = getCreatedAt(b);
        const msA = Number.isFinite(createdA) ? createdA : Number.MAX_SAFE_INTEGER;
        const msB = Number.isFinite(createdB) ? createdB : Number.MAX_SAFE_INTEGER;
        return msA - msB;
    });

    const openedRecent = blockers.filter(blocker => isWithinRange(getCreatedAt(blocker), start, end));
    const resolvedRecent = blockers.filter(blocker => isWithinRange(getResolvedAt(blocker), start, end));

    return { open, openedRecent, resolvedRecent };
}

// --- Report Generation ---

function generateReport(period) {
    const { start, end } = getDateRange(period);
    const dateStr = formatDate(new Date());
    
    console.log(`Generating ${period} report for ${formatDate(start)} to ${formatDate(end)}...`);

    const tasks = getTasks(start, end);
    const projects = getProjectUpdates(start, end);
    const logs = getDailyLogs(start, end);
    const blockers = getBlockers(start, end);

    let md = `# Relatório de Status Profissional - ${dateStr}\n`;
    md += `**Período:** ${formatDate(start)} a ${formatDate(end)}\n\n`;

    // 1. Resumo Executivo (Placeholder logic)
    md += `## 📋 Resumo Executivo\n`;
    const totalDone = tasks.completed.length;
    const activeProjects = projects.length;
    const logCount = logs.length;
    const openBlockers = blockers.open.length;
    md += `Neste período, foram concluídas **${totalDone}** entregas focais. Atualmente há **${activeProjects}** projetos com atualizações recentes. Foram registrados **${logCount}** logs diários e existem **${openBlockers}** blockers em aberto.\n\n`;

    // 2. Contexto dos Logs Diários
    md += `## 📝 Contexto dos Logs Diários\n`;
    if (logs.length === 0) {
        md += `*Sem logs diários no período.*\n\n`;
    } else {
        logs
            .sort((a, b) => a.date.localeCompare(b.date))
            .forEach(log => {
                const summary = summarizeLogContent(log.content) || 'Log registrado sem destaques.';
                md += `- **${log.date}:** ${summary}\n`;
            });
        md += `\n`;
    }

    // 3. Principais Entregas
    md += `## ✅ Principais Entregas\n`;
    if (tasks.completed.length === 0) {
        md += `*Nenhuma entrega registrada no período.*\n`;
    } else {
        tasks.completed.forEach(t => {
            const projectTag = t.projectSlug ? `\`[${t.projectSlug}]\`` : '';
            md += `- ${projectTag} ${t.description}\n`;
        });
    }
    md += `\n`;

    // 4. Status dos Projetos
    md += `## 🏗️ Status dos Projetos\n`;
    if (projects.length === 0) {
        md += `*Sem atualizações de projeto recentes.*\n`;
    } else {
        projects.forEach(p => {
            md += `### ${p.client} / ${p.name}\n`;
            md += `**Status Atual:** ${p.status}\n`;
            if (p.events.length > 0) {
                md += `**Atualizações Recentes:**\n`;
                p.events.forEach(e => {
                    const typeIcon = e.type === 'Blocker' ? '🔴' : '🔹';
                    md += `- ${typeIcon} [${e.date}] ${e.content}\n`;
                });
            }
            md += `\n`;
        });
    }

    // 5. Bloqueios
    md += `## 🚧 Bloqueios\n`;
    if (blockers.open.length === 0) {
        md += `*Nenhum blocker em aberto registrado.*\n`;
    } else {
        md += `**Em aberto:**\n`;
        blockers.open.forEach(blocker => {
            const title = getBlockerTitle(blocker);
            const severity = normalizeSeverity(blocker);
            const createdAt = getCreatedAt(blocker);
            const createdDate = Number.isFinite(createdAt) ? toIsoDate(createdAt) : 'Unknown';
            const project = blocker.project || blocker.projectName || blocker.projectSlug;
            const client = blocker.client || blocker.clientName || blocker.clientSlug;
            const metaParts = [
                `Severidade: ${severity}`,
                project ? `Projeto: ${project}` : null,
                client ? `Cliente: ${client}` : null,
                `Aberto: ${createdDate}`
            ].filter(Boolean);
            md += `- ${title} (${metaParts.join('; ')})\n`;
        });
    }

    if (blockers.resolvedRecent.length > 0) {
        md += `\n**Resolvidos no período:**\n`;
        blockers.resolvedRecent.forEach(blocker => {
            const title = getBlockerTitle(blocker);
            const resolvedAt = getResolvedAt(blocker);
            const resolvedDate = Number.isFinite(resolvedAt) ? toIsoDate(resolvedAt) : 'Unknown';
            md += `- ${title} (Resolvido: ${resolvedDate})\n`;
        });
    }
    md += `\n\n`;

    // 6. Próximos Passos
    md += `## 🚀 Próximos Passos\n`;
    if (tasks.pending.length === 0) {
        md += `*Sem itens prioritários na fila.*\n`;
    } else {
        tasks.pending.forEach(t => {
            const projectTag = t.projectSlug ? `\`[${t.projectSlug}]\`` : '';
            md += `- [ ] ${projectTag} ${t.description}\n`;
        });
    }
    md += `\n`;

    // Save
    ensureDir(OUTPUT_DIR);
    const filename = `executive-${period}-${dateStr}.md`;
    const outputPath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(outputPath, md, 'utf8');

    console.log(`Report generated successfully: ${outputPath}`);
    console.log(`\n--- SUMMARY PREVIEW ---\n`);
    console.log(md.substring(0, 500) + "...");
}

// --- Main ---
const args = process.argv.slice(2);
const periodIdx = args.indexOf('--period');
const period = periodIdx !== -1 ? args[periodIdx + 1] : 'daily';

if (!['daily', 'weekly'].includes(period)) {
    console.error("Invalid period. Use 'daily' or 'weekly'.");
    process.exit(1);
}

generateReport(period);
