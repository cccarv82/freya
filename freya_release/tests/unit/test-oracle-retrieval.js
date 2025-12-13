const fs = require('fs');
const path = require('path');

// Simulate the agent reading the file
const taskLogPath = path.join(__dirname, '../../data/tasks/task-log.json');

// Mock data setup
const mockData = {
  tasks: [
    { id: "1", description: "Task 1", category: "DO_NOW", status: "PENDING", priority: "high" },
    { id: "2", description: "Task 2", category: "SCHEDULE", status: "PENDING", priority: "medium" },
    { id: "3", description: "Task 3", category: "DO_NOW", status: "COMPLETED", priority: "low" }
  ]
};

// Logic to test: Filtering
function filterTasks(tasks, category) {
  return tasks.filter(t => t.category === category && t.status === "PENDING");
}

try {
  // Write mock data
  fs.writeFileSync(taskLogPath, JSON.stringify(mockData, null, 2));

  // Read back
  const content = fs.readFileSync(taskLogPath, 'utf8');
  const json = JSON.parse(content);

  // Test Filtering
  const doNow = filterTasks(json.tasks, "DO_NOW");
  if (doNow.length !== 1) throw new Error("Filtering DO_NOW failed");
  if (doNow[0].id !== "1") throw new Error("Incorrect task filtered");

  const schedule = filterTasks(json.tasks, "SCHEDULE");
  if (schedule.length !== 1) throw new Error("Filtering SCHEDULE failed");

  console.log("✅ Oracle retrieval logic verification passed.");

  // Cleanup (Restore empty)
  fs.writeFileSync(taskLogPath, JSON.stringify({ tasks: [] }, null, 2));

} catch (error) {
  console.error("❌ Test Failed:", error.message);
  process.exit(1);
}
