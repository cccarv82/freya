const fs = require('fs');
const path = require('path');

const taskLogPath = path.join(__dirname, '../../data/tasks/task-log.json');

// Mock Data representing what Ingestor would produce
const mockTask = {
  id: "test-task-123",
  description: "Pay the bills",
  category: "DO_NOW",
  status: "PENDING",
  createdAt: new Date().toISOString(),
  priority: "high"
};

try {
  // 1. Read
  if (!fs.existsSync(taskLogPath)) {
    throw new Error("task-log.json not found");
  }
  const content = fs.readFileSync(taskLogPath, 'utf8');
  const json = JSON.parse(content);

  // 2. Append (Simulate Agent Action)
  json.tasks.push(mockTask);

  // 3. Write
  fs.writeFileSync(taskLogPath, JSON.stringify(json, null, 2));
  console.log("✅ Written mock task to file.");

  // 4. Verify
  const newContent = fs.readFileSync(taskLogPath, 'utf8');
  const newJson = JSON.parse(newContent);
  const savedTask = newJson.tasks.find(t => t.id === "test-task-123");

  if (!savedTask) throw new Error("Task not saved");
  if (savedTask.description !== "Pay the bills") throw new Error("Description mismatch");
  if (savedTask.category !== "DO_NOW") throw new Error("Category mismatch");

  console.log("✅ Verification successful: Task persisted correctly.");

  // Cleanup
  json.tasks = json.tasks.filter(t => t.id !== "test-task-123");
  fs.writeFileSync(taskLogPath, JSON.stringify(json, null, 2));
  console.log("✅ Cleanup successful.");

} catch (error) {
  console.error("❌ Test Failed:", error.message);
  process.exit(1);
}
