const fs = require('fs');
const path = require('path');
const os = require('os');
const { initWorkspace } = require('../../cli/init');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'freya-cli-init-'));
const target = path.join(tempRoot, 'workspace');

async function run() {
  // 1) default creates ./freya
  const defaultCwd = path.join(tempRoot, 'default');
  fs.mkdirSync(defaultCwd, { recursive: true });
  const defaultTarget = path.join(defaultCwd, 'freya');
  await initWorkspace({ targetDir: defaultTarget, force: false });

  // 2) explicit dir
  await initWorkspace({ targetDir: target, force: false });

  const mustExist = [
    path.join(target, '.agent', 'rules', 'freya', 'agents', 'master.mdc'),
    path.join(target, 'scripts', 'validate-data.js'),
    path.join(target, 'data', 'tasks', 'task-log.json'),
    path.join(target, 'data', 'career', 'career-log.json'),
    path.join(target, 'package.json')
  ];

  const mustExistDefault = [
    path.join(defaultTarget, '.agent', 'rules', 'freya', 'agents', 'master.mdc'),
    path.join(defaultTarget, 'scripts', 'validate-data.js'),
    path.join(defaultTarget, 'package.json')
  ];

  for (const p of mustExist) {
    if (!exists(p)) throw new Error(`missing expected file: ${p}`);
  }
  for (const p of mustExistDefault) {
    if (!exists(p)) throw new Error(`missing expected file (default): ${p}`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts.health || !pkg.scripts['sm-weekly']) {
    throw new Error('package.json scripts not initialized');
  }

  // 3) in-place
  const inPlaceDir = path.join(tempRoot, 'inplace');
  fs.mkdirSync(inPlaceDir, { recursive: true });
  await initWorkspace({ targetDir: inPlaceDir, force: false });
  if (!exists(path.join(inPlaceDir, '.agent', 'rules', 'freya', 'agents', 'master.mdc'))) {
    throw new Error('in-place init did not create expected files');
  }

  // 4) preserve data/logs when present
  const preserveDir = path.join(tempRoot, 'preserve');
  fs.mkdirSync(path.join(preserveDir, 'data', 'tasks'), { recursive: true });
  fs.mkdirSync(path.join(preserveDir, 'logs', 'daily'), { recursive: true });
  fs.writeFileSync(path.join(preserveDir, 'data', 'tasks', 'task-log.json'), JSON.stringify({ schemaVersion: 1, tasks: [{ id: 'keep', description: 'keep', category: 'DO_NOW', status: 'PENDING', createdAt: new Date().toISOString() }] }, null, 2));
  fs.writeFileSync(path.join(preserveDir, 'logs', 'daily', '2026-01-01.md'), 'keep\n', 'utf8');

  await initWorkspace({ targetDir: preserveDir, force: false });
  const afterTask = JSON.parse(fs.readFileSync(path.join(preserveDir, 'data', 'tasks', 'task-log.json'), 'utf8'));
  if (!afterTask.tasks || !afterTask.tasks.find((t) => t.id === 'keep')) {
    throw new Error('data/ was not preserved');
  }
  if (!exists(path.join(preserveDir, 'logs', 'daily', '2026-01-01.md'))) {
    throw new Error('logs/ was not preserved');
  }

  console.log('✅ PASS: workspace init supports default dir, explicit dir, in-place, and preserves data/logs');
}

run().catch((e) => {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
}).finally(() => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});
