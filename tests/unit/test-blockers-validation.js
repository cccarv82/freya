const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.join(__dirname, '../..');
const blockersPath = path.join(repoRoot, 'data/blockers/blocker-log.json');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const original = readFileSafe(blockersPath);

try {
  fs.mkdirSync(path.dirname(blockersPath), { recursive: true });

  // Invalid severity enum should fail validate-data.
  const invalid = {
    schemaVersion: 1,
    blockers: [
      {
        id: 'b1',
        title: 'Bad severity',
        description: 'Should fail validation',
        createdAt: new Date().toISOString(),
        status: 'OPEN',
        severity: 'URGENT'
      }
    ]
  };

  fs.writeFileSync(blockersPath, JSON.stringify(invalid, null, 2));

  const res = spawnSync('node', ['scripts/validate-data.js'], {
    cwd: repoRoot,
    encoding: 'utf8'
  });

  if (res.status === 0) {
    console.error('❌ FAIL: validate-data unexpectedly succeeded');
    process.exit(1);
  }

  console.log('✅ PASS: validate-data fails on invalid blocker enums');
} catch (e) {
  console.error('❌ FAIL:', e.message);
  process.exit(1);
} finally {
  if (original === null) {
    try { fs.unlinkSync(blockersPath); } catch {}
  } else {
    fs.writeFileSync(blockersPath, original);
  }
}
