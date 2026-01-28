const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '../..');
const tasksPath = path.join(repoRoot, 'data/tasks/task-log.json');
const blockersPath = path.join(repoRoot, 'data/blockers/blocker-log.json');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const origTasks = readFileSafe(tasksPath);
const origBlockers = readFileSafe(blockersPath);

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

try {
  // seed tasks
  const tasks = {
    schemaVersion: 1,
    tasks: [
      { id: 't1', description: 'Ship thing', category: 'DO_NOW', status: 'COMPLETED', createdAt: daysAgo(8), completedAt: daysAgo(2) },
      { id: 't2', description: 'Prep deck', category: 'DO_NOW', status: 'PENDING', createdAt: daysAgo(1) }
    ]
  };
  fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2));

  const blockers = {
    schemaVersion: 1,
    blockers: [
      { id: 'b1', title: 'Critical outage', description: 'x', createdAt: daysAgo(5), status: 'OPEN', severity: 'CRITICAL', nextAction: 'Escalate' },
      { id: 'b2', title: 'Minor annoyance', description: 'x', createdAt: daysAgo(10), status: 'OPEN', severity: 'LOW' }
    ]
  };
  fs.writeFileSync(blockersPath, JSON.stringify(blockers, null, 2));

  const res = spawnSync('node', ['scripts/generate-sm-weekly-report.js'], { cwd: repoRoot, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`generate-sm-weekly-report failed: ${res.stderr || res.stdout || 'unknown error'}`);
  }
  const out = res.stdout;

  if (!out.includes('## Summary')) throw new Error('missing Summary section');
  if (!out.includes('## Wins')) throw new Error('missing Wins section');
  if (!out.includes('## Blockers & Risks')) throw new Error('missing Blockers section');
  if (!out.includes('## Next Week Focus')) throw new Error('missing Next Week Focus section');

  const idxCritical = out.indexOf('Critical outage');
  const idxLow = out.indexOf('Minor annoyance');
  if (idxCritical === -1 || idxLow === -1 || idxCritical > idxLow) {
    throw new Error('blockers not ordered by severity');
  }

  console.log('✅ PASS: sm-weekly report includes sections and orders blockers by severity');
} catch (e) {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
} finally {
  if (origTasks === null) {
    try { fs.unlinkSync(tasksPath); } catch {}
  } else {
    fs.writeFileSync(tasksPath, origTasks);
  }
  if (origBlockers === null) {
    try { fs.unlinkSync(blockersPath); } catch {}
  } else {
    fs.writeFileSync(blockersPath, origBlockers);
  }
}
