const assert = require('assert');

// --- Mock Data ---
const now = new Date();
const oneDay = 24 * 60 * 60 * 1000;

function daysAgo(n) {
    return new Date(now.getTime() - (n * oneDay)).toISOString();
}

const mockProjectStatus = {
    client: "Acme",
    project: "Rocket",
    history: [
        { date: daysAgo(2), type: "Status Update", content: "Launched stage 1" },
        { date: daysAgo(10), type: "Status Update", content: "Old update" } // Should be filtered out
    ]
};

const mockTaskLog = {
    tasks: [
        { id: "1", description: "Fix bug", status: "COMPLETED", completedAt: daysAgo(1) },
        { id: "2", description: "Write docs", status: "COMPLETED", completedAt: daysAgo(8) }, // Should be filtered out
        { id: "3", description: "Ongoing work", status: "PENDING" } // Should be filtered out
    ]
};

const mockCareerLog = {
    entries: [
        { date: daysAgo(3), type: "Feedback", description: "Great job on the launch" },
        { date: daysAgo(15), type: "Goal", description: "Learn Rust" } // Should be filtered out
    ]
};

// --- Logic to Test ---

function isWithinWeek(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const sevenDaysAgo = new Date(now.getTime() - (7 * oneDay));
    return date >= sevenDaysAgo && date <= now;
}

function generateReport(projects, tasks, career) {
    let report = "# Weekly Report\n\n";

    // 1. Projects
    report += "## Project Updates\n";
    projects.forEach(p => {
        const recentUpdates = p.history.filter(h => isWithinWeek(h.date));
        if (recentUpdates.length > 0) {
            report += `### ${p.client} - ${p.project}\n`;
            recentUpdates.forEach(u => {
                report += `- **${u.date.split('T')[0]}**: ${u.content}\n`;
            });
        }
    });

    // 2. Tasks
    report += "\n## Completed Tasks\n";
    const recentTasks = tasks.tasks.filter(t => t.status === "COMPLETED" && isWithinWeek(t.completedAt));
    if (recentTasks.length > 0) {
        recentTasks.forEach(t => {
            report += `- ${t.description}\n`;
        });
    } else {
        report += "No tasks completed this week.\n";
    }

    // 3. Career
    report += "\n## Career Highlights\n";
    const recentCareer = career.entries.filter(e => isWithinWeek(e.date));
    if (recentCareer.length > 0) {
        recentCareer.forEach(e => {
            report += `- **[${e.type}]**: ${e.description}\n`;
        });
    } else {
        report += "No career updates this week.\n";
    }

    return report;
}

// --- Test Execution ---

try {
    console.log("🧪 Testing Report Generation Logic...");

    const report = generateReport([mockProjectStatus], mockTaskLog, mockCareerLog);
    
    console.log("--- Generated Report Output ---");
    console.log(report);
    console.log("-------------------------------");

    // Assertions
    assert.ok(report.includes("Launched stage 1"), "Should include recent project update");
    assert.ok(!report.includes("Old update"), "Should NOT include old project update");
    
    assert.ok(report.includes("Fix bug"), "Should include recent completed task");
    assert.ok(!report.includes("Write docs"), "Should NOT include old completed task");
    assert.ok(!report.includes("Ongoing work"), "Should NOT include pending task");

    assert.ok(report.includes("Great job"), "Should include recent career entry");
    assert.ok(!report.includes("Learn Rust"), "Should NOT include old career entry");

    console.log("✅ All tests passed!");

} catch (e) {
    console.error("❌ Test Failed:", e.message);
    process.exit(1);
}
