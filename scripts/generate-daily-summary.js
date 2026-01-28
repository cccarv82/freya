const fs = require('fs');
const path = require('path');

const { safeParseToMs } = require('./lib/date-utils');

const TASK_LOG_PATH = path.join(__dirname, '../data/tasks/task-log.json');

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

        // 3. Bloqueios (Placeholder until Blockers are implemented)
        summary += "**Bloqueios:** None";

        console.log(summary);

    } catch (err) {
        console.error("Error generating daily:", err.message);
    }
}

generateDailySummary();
