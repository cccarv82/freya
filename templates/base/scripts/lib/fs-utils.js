const fs = require('fs');
const path = require('path');

function safeReadJson(filePath) {
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return { ok: false, error: { type: 'read', message: error.message, cause: error } };
  }

  try {
    const json = JSON.parse(content);
    return { ok: true, json };
  } catch (error) {
    return { ok: false, error: { type: 'parse', message: error.message, cause: error } };
  }
}

function timestampForFilename(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function quarantineCorruptedFile(filePath, reason) {
  const dir = path.dirname(filePath);
  const corruptedDir = path.join(dir, '_corrupted');
  if (!fs.existsSync(corruptedDir)) {
    fs.mkdirSync(corruptedDir, { recursive: true });
  }

  const parsed = path.parse(filePath);
  const timestamp = timestampForFilename();
  const quarantinedName = `${parsed.name}-${timestamp}${parsed.ext}`;
  const quarantinedPath = path.join(corruptedDir, quarantinedName);

  try {
    fs.renameSync(filePath, quarantinedPath);
  } catch (error) {
    fs.copyFileSync(filePath, quarantinedPath);
    fs.unlinkSync(filePath);
  }

  const notePath = `${quarantinedPath}.md`;
  const note = [
    '# Quarantined JSON',
    '',
    `- Original: ${filePath}`,
    `- Quarantined: ${quarantinedPath}`,
    `- Timestamp: ${new Date().toISOString()}`,
    `- Reason: ${reason || 'Unknown JSON parse error'}`
  ].join('\n');

  fs.writeFileSync(notePath, note, 'utf8');

  return { quarantinedPath, notePath };
}

module.exports = {
  safeReadJson,
  quarantineCorruptedFile
};
