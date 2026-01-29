const fs = require('fs');
const path = require('path');

const { safeParseToMs } = require('./lib/date-utils');
const { safeReadJson, quarantineCorruptedFile } = require('./lib/fs-utils');

const TASK_LOG_PATH = path.join(__dirname, '../data/tasks/task-log.json');
const BLOCKERS_LOG_PATH = path.join(__dirname, '../data/blockers/blocker-log.json');
const REPORT_DIR = path.join(__dirname, '../docs/reports');

// --- Helper Logic ---
const now = new Date();
const oneDay = 24 * 60 * 60 * 1000;

function isRecentlyCompleted(dateStr) {
    const ms = safeParseToMs(dateStr);
    if (!Number.isFinite(ms)) return false;
    const diff = now.getTime() - ms;
    // Consider "Yesterday" as anything completed in the last 24 hours for daily sync purposes
    return diff >= 0 && diff <= oneDay;
}

function generateDailySummary() {
    try {
        if (!fs.existsSync(TASK_LOG_PATH)) {
            console.log("**Ontem:** No task log found.\n**Hoje:** Set up task log.\n**Bloqueios:** None");
            return;
        }

        const content = fs.readFileSync(TASK_LOG_PATH, 'utf8');
        const json = JSON.parse(content);
        
        if (!json.tasks) {
            console.log("**Ontem:** Invalid task log.\n**Hoje:** Fix task log.\n**Bloqueios:** None");
            return;
        }

        let summary = "";

        // 1. Ontem (Completed < 24h)
        const completedRecently = json.tasks.filter(t => t.status === "COMPLETED" && isRecentlyCompleted(t.completedAt));
        summary += "**Ontem:** ";
        if (completedRecently.length > 0) {
            summary += completedRecently.map(t => t.description).join(", ");
        } else {
            summary += "Nothing recorded";
        }
        summary += "\n";

        // 2. Hoje (DO_NOW + PENDING)
        const doNow = json.tasks.filter(t => t.status === "PENDING" && t.category === "DO_NOW");
        summary += "**Hoje:** ";
        if (doNow.length > 0) {
            summary += doNow.map(t => t.description).join(", ");
        } else {
            summary += "Nothing planned";
        }
        summary += "\n";

        // 3. Bloqueios (from blocker-log.json)
        let blockersLine = "None";
        if (fs.existsSync(BLOCKERS_LOG_PATH)) {
            const res = safeReadJson(BLOCKERS_LOG_PATH);
            if (!res.ok) {
                if (res.error.type === 'parse') {
                    quarantineCorruptedFile(BLOCKERS_LOG_PATH, res.error.message);
                }
            } else {
                const blockers = (res.json.blockers || []).filter(b => {
                    const st = (b.status || '').toUpperCase();
                    return st === 'OPEN' || st === 'MITIGATING';
                });
                const sevOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
                blockers.sort((a, b) => {
                    const sa = sevOrder[(a.severity || '').toUpperCase()] ?? 99;
                    const sb = sevOrder[(b.severity || '').toUpperCase()] ?? 99;
                    if (sa !== sb) return sa - sb;
                    const ta = safeParseToMs(a.createdAt) || 0;
                    const tb = safeParseToMs(b.createdAt) || 0;
                    return ta - tb; // older first
                });
                if (blockers.length > 0) {
                    blockersLine = blockers.slice(0, 3).map(b => b.title || b.description || b.id).join(", ");
                }
            }
        }

        summary += `**Bloqueios:** ${blockersLine}`;

        console.log(summary);

        // Write report file for UI (optional, but helps preview/history)
        try {
            fs.mkdirSync(REPORT_DIR, { recursive: true });
            const date = new Date().toISOString().slice(0, 10);
            const outPath = path.join(REPORT_DIR, `daily-${date}.md`);
            fs.writeFileSync(outPath, `# Daily Summary — ${date}\n\n${summary}\n`, 'utf8');
        } catch (e) {
            // non-fatal
        }

    } catch (err) {
        console.error("Error generating daily:", err.message);
    }
}

generateDailySummary();
