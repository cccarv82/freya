const { spawnSync } = require('child_process');
const path = require('path');

const repoRoot = path.join(__dirname, '../..');

try {
  const res = spawnSync('node', [path.join(repoRoot, 'bin/freya.js'), '--help'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (res.status !== 0) {
    console.error('❌ FAIL: help exited non-zero');
    process.exit(1);
  }

  const out = (res.stdout || '') + (res.stderr || '');
  if (!out.includes('FREYA web')) {
    console.error('❌ FAIL: help missing FREYA web header');
    process.exit(1);
  }

  if (!out.includes('--port')) {
    console.error('❌ FAIL: help missing --port option');
    process.exit(1);
  }

  console.log('✅ PASS: web help includes options');
} catch (e) {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
}
