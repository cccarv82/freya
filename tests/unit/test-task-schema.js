const fs = require('fs');
const path = require('path');

const taskLogPath = path.join(__dirname, '../../data/tasks/task-log.json');

try {
  if (!fs.existsSync(taskLogPath)) {
    console.error('❌ FAIL: task-log.json does not exist');
    process.exit(1);
  }

  const content = fs.readFileSync(taskLogPath, 'utf8');
  const json = JSON.parse(content);

  if (json.schemaVersion === undefined || typeof json.schemaVersion !== 'number') {
    console.error('❌ FAIL: "schemaVersion" is missing or not a number');
    process.exit(1);
  }

  if (!Array.isArray(json.tasks)) {
    console.error('❌ FAIL: "tasks" is not an array');
    process.exit(1);
  }

  if (json.tasks.length !== 0) {
    console.error('❌ FAIL: "tasks" array is not empty initially');
    process.exit(1);
  }

  console.log('✅ PASS: task-log.json is valid and initialized correctly');
} catch (error) {
  console.error('❌ FAIL: Error parsing JSON or verifying file:', error.message);
  process.exit(1);
}
