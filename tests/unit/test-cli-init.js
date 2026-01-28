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
  // 1) default creates ./freya
  const defaultCwd = path.join(tempRoot, 'default');
  fs.mkdirSync(defaultCwd, { recursive: true });
  const resDefault = spawnSync('node', [path.join(repoRoot, 'bin/freya.js'), 'init'], {
    cwd: defaultCwd,
    encoding: 'utf8'
  });
  if (resDefault.status !== 0) {
    console.error('❌ FAIL: freya init (default) exited non-zero');
    if (resDefault.stdout) console.error(resDefault.stdout);
    if (resDefault.stderr) console.error(resDefault.stderr);
    process.exit(1);
  }
  const defaultTarget = path.join(defaultCwd, 'freya');

  // 2) explicit dir
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
  const resHere = spawnSync('node', [path.join(repoRoot, 'bin/freya.js'), 'init', '--here'], {
    cwd: inPlaceDir,
    encoding: 'utf8'
  });
  if (resHere.status !== 0) {
    console.error('❌ FAIL: freya init --here exited non-zero');
    if (resHere.stdout) console.error(resHere.stdout);
    if (resHere.stderr) console.error(resHere.stderr);
    process.exit(1);
  }
  if (!exists(path.join(inPlaceDir, '.agent', 'rules', 'freya', 'agents', 'master.mdc'))) {
    throw new Error('in-place init did not create expected files');
  }

  console.log('✅ PASS: freya init supports default dir, explicit dir, and in-place');
} catch (e) {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
} finally {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
}
