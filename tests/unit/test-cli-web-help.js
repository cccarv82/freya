const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.join(__dirname, '../..');

try {
  const res = spawnSync('node', [path.join(repoRoot, 'bin/freya.js'), 'help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (res.status !== 0) {
    console.error('❌ FAIL: help exited non-zero');
    process.exit(1);
  }

  const out = (res.stdout || '') + (res.stderr || '');
  if (!out.includes('freya web')) {
    console.error('❌ FAIL: help missing freya web');
    process.exit(1);
  }

  console.log('✅ PASS: CLI help includes web command');
} catch (e) {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
}
