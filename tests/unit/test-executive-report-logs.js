const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { toIsoDate } = require('../../scripts/lib/date-utils');

const repoRoot = path.join(__dirname, '../..');
const logsDir = path.join(repoRoot, 'logs/daily');
const reportsDir = path.join(repoRoot, 'docs/reports');
const dateStr = toIsoDate(new Date());
const logPath = path.join(logsDir, `${dateStr}.md`);
let reportPath = null;

const sampleLog = `# Daily Log\n- Met with team about release\n- Blocked by API timeout\n`;

let previousLog = null;
let previousReport = null;

try {
  fs.mkdirSync(logsDir, { recursive: true });

  if (fs.existsSync(logPath)) {
    previousLog = fs.readFileSync(logPath, 'utf8');
  }
  const existingReports = fs.readdirSync(reportsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.startsWith(`executive-daily-${dateStr}`))
    .map((e) => path.join(reportsDir, e.name));
  if (existingReports.length) {
    existingReports.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    previousReport = fs.readFileSync(existingReports[0], 'utf8');
  }

  fs.writeFileSync(logPath, sampleLog, 'utf8');

  execSync('node scripts/generate-executive-report.js --period daily', {
    cwd: repoRoot,
    stdio: 'ignore'
  });

  const generated = fs.readdirSync(reportsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.startsWith(`executive-daily-${dateStr}`))
    .map((e) => path.join(reportsDir, e.name));
  if (!generated.length) throw new Error('Report file not found');
  generated.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  reportPath = generated[0];
  const report = fs.readFileSync(reportPath, 'utf8');

  assert.ok(report.includes('Contexto dos Logs'), 'Should include daily log context section');
  assert.ok(report.includes('Met with team about release'), 'Should include daily log summary content');

  console.log('OK: Executive report includes daily logs context.');
} catch (error) {
  console.error('FAIL: Test Failed:', error.message);
  process.exit(1);
} finally {
  if (previousLog !== null) {
    fs.writeFileSync(logPath, previousLog, 'utf8');
  } else if (fs.existsSync(logPath)) {
    fs.unlinkSync(logPath);
  }

  if (reportPath && fs.existsSync(reportPath)) {
    if (previousReport !== null) {
      fs.writeFileSync(reportPath, previousReport, 'utf8');
    } else {
      fs.unlinkSync(reportPath);
    }
  }
}
