const fs = require('fs');
const path = require('path');

const { safeReadJson, quarantineCorruptedFile } = require('../../scripts/lib/fs-utils');

const tmpRoot = path.join(__dirname, '../tmp-fs-utils');
const validPath = path.join(tmpRoot, 'valid.json');
const invalidPath = path.join(tmpRoot, 'invalid.json');

function resetTmp() {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });
}

try {
  resetTmp();

  fs.writeFileSync(validPath, JSON.stringify({ ok: true }), 'utf8');
  const validResult = safeReadJson(validPath);
  if (!validResult.ok || validResult.json.ok !== true) {
    throw new Error('safeReadJson failed on valid JSON');
  }

  fs.writeFileSync(invalidPath, '{"bad":', 'utf8');
  const invalidResult = safeReadJson(invalidPath);
  if (invalidResult.ok || invalidResult.error.type !== 'parse') {
    throw new Error('safeReadJson did not detect parse error');
  }

  const quarantineResult = quarantineCorruptedFile(invalidPath, invalidResult.error.message);
  if (fs.existsSync(invalidPath)) {
    throw new Error('quarantineCorruptedFile did not move file');
  }

  if (!fs.existsSync(quarantineResult.quarantinedPath)) {
    throw new Error('quarantined file missing');
  }

  if (!fs.existsSync(quarantineResult.notePath)) {
    throw new Error('quarantine note missing');
  }

  const note = fs.readFileSync(quarantineResult.notePath, 'utf8');
  if (!note.includes(invalidResult.error.message)) {
    throw new Error('quarantine note does not include reason');
  }

  console.log('✅ PASS: fs-utils helpers behave correctly');
} catch (error) {
  console.error('❌ FAIL:', error.message);
  process.exit(1);
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
