const assert = require('assert');

// --- Mock Data ---
const now = new Date();
const oneDay = 24 * 60 * 60 * 1000;

function daysAgo(n) {
    return new Date(now.getTime() - (n * oneDay)).toISOString();
}

const mockTaskLog = {
    tasks: [
        { id: "1", description: "Fixed bug #123", status: "COMPLETED", completedAt: daysAgo(1) },
        { id: "2", description: "Updated docs", status: "COMPLETED", completedAt: daysAgo(5) }, // Too old
        { id: "3", description: "Critical Feature", category: "DO_NOW", status: "PENDING" },
        { id: "4", description: "Someday maybe", category: "SCHEDULE", status: "PENDING" } // Not DO_NOW
    ]
};

// --- Logic to Test ---

function isYesterday(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const yesterday = new Date(now.getTime() - oneDay);
    
    // Simple check: is it within the last 24-48h window basically
    // For strict "calendar yesterday", we'd need more complex logic, but for "Daily", "last 24h" is often what's meant or "since last standup".
    // Let's implement "Completed within last 24h" for simplicity or "Same date as yesterday".
    // Let's stick to "Within last 24 hours" for this test context.
    const diff = now - date;
    return diff <= oneDay; 
}

function generateDaily(tasks) {
    let summary = "";

    // Yesterday (Completed recently)
    const completedRecently = tasks.tasks.filter(t => t.status === "COMPLETED" && isYesterday(t.completedAt));
    summary += "**Ontem:** ";
    if (completedRecently.length > 0) {
        summary += completedRecently.map(t => t.description).join(", ");
    } else {
        summary += "Nothing recorded";
    }
    summary += "\n";

    // Today (DO_NOW + PENDING)
    const doNow = tasks.tasks.filter(t => t.status === "PENDING" && t.category === "DO_NOW");
    summary += "**Hoje:** ";
    if (doNow.length > 0) {
        summary += doNow.map(t => t.description).join(", ");
    } else {
        summary += "Nothing planned";
    }
    summary += "\n";

    // Blockers (Mocked as none for now as we don't have blocker log yet)
    summary += "**Bloqueios:** None";

    return summary;
}

// --- Test Execution ---

try {
    console.log("🧪 Testing Daily Summary Generation...");

    const summary = generateDaily(mockTaskLog);
    
    console.log("--- Output ---");
    console.log(summary);
    console.log("--------------");

    assert.ok(summary.includes("Fixed bug #123"), "Should include yesterday's task");
    assert.ok(!summary.includes("Updated docs"), "Should NOT include old task");
    assert.ok(summary.includes("Critical Feature"), "Should include DO_NOW task");
    assert.ok(!summary.includes("Someday maybe"), "Should NOT include SCHEDULE task");

    console.log("✅ All tests passed!");

} catch (e) {
    console.error("❌ Test Failed:", e.message);
    process.exit(1);
}
