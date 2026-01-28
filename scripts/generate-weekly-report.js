const fs = require('fs');
const path = require('path');

const { toIsoDate, isWithinRange } = require('./lib/date-utils');

const DATA_DIR = path.join(__dirname, '../data');
const REPORT_DIR = path.join(__dirname, '../docs/reports');

// Ensure output dir exists
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

// --- Date Logic ---
const now = new Date();
const oneDay = 24 * 60 * 60 * 1000;

function isWithinWeek(dateStr) {
    const sevenDaysAgo = new Date(now.getTime() - (7 * oneDay));
    return isWithinRange(dateStr, sevenDaysAgo, now);
}

function getFormattedDate() {
    return toIsoDate(now);
}

// --- File Walking ---
function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            walk(filePath, fileList);
        } else {
            if (path.extname(file) === '.json') {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

// --- Aggregation ---
function generateWeeklyReport() {
    const files = walk(DATA_DIR);
    
    const projects = [];
    let taskLog = { schemaVersion: 1, tasks: [] };
    let careerLog = { entries: [] };

    // 1. Collect Data
    files.forEach(file => {
        try {
            const content = fs.readFileSync(file, 'utf8');
            const json = JSON.parse(content);

            if (file.endsWith('task-log.json')) {
                taskLog = json;
            } else if (file.endsWith('career-log.json')) {
                careerLog = json;
            } else if (file.endsWith('status.json')) {
                projects.push(json);
            }
        } catch (err) {
            console.error(`Error reading ${file}: ${err.message}`);
        }
    });

    // 2. Generate Content
    const reportDate = getFormattedDate();
    let report = `# Weekly Report - ${reportDate}\n\n`;

    // Projects
    report += "## 🚀 Project Updates\n";
    let hasProjectUpdates = false;
    projects.forEach(p => {
        if (p.history && Array.isArray(p.history)) {
            const recentUpdates = p.history.filter(h => isWithinWeek(h.date));
            if (recentUpdates.length > 0) {
                hasProjectUpdates = true;
                report += `### ${p.client} - ${p.project}\n`;
                recentUpdates.forEach(u => {
                    const dateStr = u.date ? u.date.split('T')[0] : 'Unknown Date';
                    report += `- **${dateStr}**: ${u.content}\n`;
                });
                report += "\n";
            }
        }
    });
    if (!hasProjectUpdates) report += "No project updates recorded this week.\n\n";

    // Tasks
    report += "## ✅ Completed Tasks\n";
    if (taskLog.tasks && Array.isArray(taskLog.tasks)) {
        const recentTasks = taskLog.tasks.filter(t => t.status === "COMPLETED" && isWithinWeek(t.completedAt));
        if (recentTasks.length > 0) {
            recentTasks.forEach(t => {
                report += `- ${t.description}\n`;
            });
        } else {
            report += "No tasks completed this week.\n";
        }
    } else {
        report += "No task log found.\n";
    }
    report += "\n";

    // Career
    report += "## 🌟 Career Highlights\n";
    if (careerLog.entries && Array.isArray(careerLog.entries)) {
        const recentCareer = careerLog.entries.filter(e => isWithinWeek(e.date));
        if (recentCareer.length > 0) {
            recentCareer.forEach(e => {
                report += `- **[${e.type}]**: ${e.description}\n`;
            });
        } else {
            report += "No career updates this week.\n";
        }
    } else {
        report += "No career log found.\n";
    }

    // 3. Save and Output
    const outputPath = path.join(REPORT_DIR, `weekly-${reportDate}.md`);
    fs.writeFileSync(outputPath, report);
    
    console.log(`✅ Report generated at: ${outputPath}`);
    console.log("---------------------------------------------------");
    console.log(report);
    console.log("---------------------------------------------------");
}

generateWeeklyReport();
