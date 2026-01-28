const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '../..');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'freya-cli-init-'));
const target = path.join(tempRoot, 'workspace');

try {
  const res = spawnSync('node', ['bin/freya.js', 'init', target], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (res.status !== 0) {
    console.error('❌ FAIL: freya init exited non-zero');
    if (res.stdout) console.error(res.stdout);
    if (res.stderr) console.error(res.stderr);
    process.exit(1);
  }

  const mustExist = [
    path.join(target, '.agent', 'rules', 'freya', 'agents', 'master.mdc'),
    path.join(target, 'scripts', 'validate-data.js'),
    path.join(target, 'data', 'tasks', 'task-log.json'),
    path.join(target, 'data', 'career', 'career-log.json'),
    path.join(target, 'package.json')
  ];

  for (const p of mustExist) {
    if (!exists(p)) throw new Error(`missing expected file: ${p}`);
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(target, 'package.json'), 'utf8'));
  if (!pkg.scripts || !pkg.scripts.health || !pkg.scripts['sm-weekly']) {
    throw new Error('package.json scripts not initialized');
  }

  console.log('✅ PASS: freya init creates workspace skeleton');
} catch (e) {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
} finally {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}
