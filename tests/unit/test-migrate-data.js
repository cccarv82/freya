const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '../..');
const migrateScript = path.join(repoRoot, 'scripts/migrate-data.js');

function writeJson(filePath, json) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'freya-migrate-'));
const dataDir = path.join(tempRoot, 'data');

const taskLogPath = path.join(dataDir, 'tasks', 'task-log.json');
const careerLogPath = path.join(dataDir, 'career', 'career-log.json');

try {
  const taskSeed = {
    tasks: [
      { id: 't1', description: 'Test task', category: 'DO_NOW', status: 'PENDING', createdAt: new Date().toISOString() }
    ]
  };
  const careerSeed = {
    entries: [
      { id: 'e1', date: new Date().toISOString(), type: 'Achievement', description: 'Did a thing' }
    ]
  };

  writeJson(taskLogPath, taskSeed);
  writeJson(careerLogPath, careerSeed);

  const res = spawnSync('node', [migrateScript], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: { ...process.env, DATA_DIR: dataDir }
  });

  if (res.status !== 0) {
    console.error('❌ FAIL: migrate-data exited non-zero');
    if (res.stdout) console.error(res.stdout);
    if (res.stderr) console.error(res.stderr);
    process.exit(1);
  }

  const migratedTasks = readJson(taskLogPath);
  if (migratedTasks.schemaVersion !== 1) {
    throw new Error('task-log.json missing schemaVersion after migration');
  }
  if (!Array.isArray(migratedTasks.tasks) || migratedTasks.tasks.length !== 1) {
    throw new Error('task-log.json tasks were not preserved');
  }

  const migratedCareer = readJson(careerLogPath);
  if (migratedCareer.schemaVersion !== 1) {
    throw new Error('career-log.json missing schemaVersion after migration');
  }
  if (!Array.isArray(migratedCareer.entries) || migratedCareer.entries.length !== 1) {
    throw new Error('career-log.json entries were not preserved');
  }

  console.log('✅ PASS: migrate-data adds schemaVersion to known logs');
} catch (e) {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
} finally {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}
