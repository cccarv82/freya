/**
 * generate-executive-report.js
 * Generates a professional Markdown status report (Daily/Weekly)
 * aggregating Tasks, Project Updates, and Daily Logs.
 * 
 * Usage: node scripts/generate-executive-report.js --period [daily|weekly]
 */

const fs = require('fs');
const path = require('path');

const { toIsoDate, isWithinRange } = require('./lib/date-utils');

// --- Configuration ---
const DATA_DIR = path.join(__dirname, '../data');
const LOGS_DIR = path.join(__dirname, '../logs/daily');
const OUTPUT_DIR = path.join(__dirname, '../docs/reports');
const TASKS_FILE = path.join(DATA_DIR, 'tasks/task-log.json');

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
    
    try {
        const data = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
        const tasks = data.tasks || [];

        const completed = tasks.filter(t => {
            if (t.status !== 'COMPLETED' || !t.completedAt) return false;
            return isWithinRange(t.completedAt, start, end);
        });

        const pending = tasks.filter(t => t.status === 'PENDING' && t.category === 'DO_NOW');
        
        // "Blockers" could be tasks tagged as such or implicit in status? 
        // For now, we don't have explicit blocker task type, but we can look for high priority or specific keywords if we wanted.
        // Let's stick to simple PENDING DO_NOW for Next Steps.
        
        return { completed, pending };
    } catch (e) {
        console.error("Error reading tasks:", e.message);
        return { completed: [], pending: [] };
    }
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
                scan(fullPath);
            } else if (file === 'status.json') {
                try {
                    const project = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                    
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
                } catch (e) {
                    // Ignore corrupted files
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

// --- Report Generation ---

function generateReport(period) {
    const { start, end } = getDateRange(period);
    const dateStr = formatDate(new Date());
    
    console.log(`Generating ${period} report for ${formatDate(start)} to ${formatDate(end)}...`);

    const tasks = getTasks(start, end);
    const projects = getProjectUpdates(start, end);
    // const logs = getDailyLogs(start, end); // Maybe too verbose to include raw logs, let's stick to summarized data

    let md = `# Relatório de Status Profissional - ${dateStr}\n`;
    md += `**Período:** ${formatDate(start)} a ${formatDate(end)}\n\n`;

    // 1. Resumo Executivo (Placeholder logic)
    md += `## 📋 Resumo Executivo\n`;
    const totalDone = tasks.completed.length;
    const activeProjects = projects.length;
    md += `Neste período, foram concluídas **${totalDone}** entregas focais. Atualmente há **${activeProjects}** projetos com atualizações recentes.\n\n`;

    // 2. Principais Entregas
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

    // 3. Status dos Projetos
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

    // 4. Próximos Passos
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
    const filename = `report-${period}-${dateStr}.md`;
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
