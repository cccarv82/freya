const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const repoRoot = path.join(__dirname, '../..');
const blockersPath = path.join(repoRoot, 'data/blockers/blocker-log.json');

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

const original = readFileSafe(blockersPath);

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

try {
  fs.mkdirSync(path.dirname(blockersPath), { recursive: true });

  const sample = {
    schemaVersion: 1,
    blockers: [
      { id: 'c-old', title: 'CRITICAL old', description: 'x', createdAt: daysAgo(10), status: 'OPEN', severity: 'CRITICAL' },
      { id: 'c-new', title: 'CRITICAL new', description: 'x', createdAt: daysAgo(1), status: 'OPEN', severity: 'CRITICAL' },
      { id: 'h-old', title: 'HIGH old', description: 'x', createdAt: daysAgo(20), status: 'OPEN', severity: 'HIGH' },
      { id: 'm-mid', title: 'MEDIUM mid', description: 'x', createdAt: daysAgo(5), status: 'MITIGATING', severity: 'MEDIUM' },
      { id: 'r-recent', title: 'Resolved recent', description: 'x', createdAt: daysAgo(8), status: 'RESOLVED', severity: 'LOW', resolvedAt: daysAgo(2) }
    ]
  };

  fs.writeFileSync(blockersPath, JSON.stringify(sample, null, 2));

  const out = execSync('node scripts/generate-blockers-report.js', { cwd: repoRoot, encoding: 'utf8' });

  // Ensure CRITICAL comes before HIGH
  const idxCritical = out.indexOf('CRITICAL old');
  const idxHigh = out.indexOf('HIGH old');
  if (idxCritical === -1 || idxHigh === -1 || idxCritical > idxHigh) {
    throw new Error('Ordering wrong: CRITICAL should appear before HIGH');
  }

  // Within CRITICAL, older should appear before newer
  const idxCold = out.indexOf('CRITICAL old');
  const idxCnew = out.indexOf('CRITICAL new');
  if (idxCold === -1 || idxCnew === -1 || idxCold > idxCnew) {
    throw new Error('Ordering wrong: older CRITICAL should appear before newer CRITICAL');
  }

  console.log('✅ PASS: blockers report orders open blockers by severity then age');
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
