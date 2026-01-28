const fs = require('fs');
const path = require('path');

const { safeReadJson, quarantineCorruptedFile } = require('./lib/fs-utils');

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, '../data');

const KNOWN_FILES = [
  { relPath: path.join('tasks', 'task-log.json'), label: 'tasks/task-log.json' },
  { relPath: path.join('career', 'career-log.json'), label: 'career/career-log.json' },
  { relPath: path.join('blockers', 'blocker-log.json'), label: 'blockers/blocker-log.json' }
];

function atomicWriteJson(filePath, json) {
  const dir = path.dirname(filePath);
  const tmpName = `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}`;
  const tmpPath = path.join(dir, tmpName);
  fs.writeFileSync(tmpPath, JSON.stringify(json, null, 2), 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function migrateFile(filePath, label, summary) {
  if (!fs.existsSync(filePath)) {
    summary.missing.push(label);
    return;
  }

  const res = safeReadJson(filePath);
  if (!res.ok) {
    if (res.error.type === 'parse') {
      quarantineCorruptedFile(filePath, res.error.message);
      summary.quarantined.push(label);
    } else {
      summary.skipped.push(label);
    }
    return;
  }

  const json = res.json;
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    summary.skipped.push(label);
    return;
  }

  if (json.schemaVersion === undefined) {
    json.schemaVersion = 1;
    atomicWriteJson(filePath, json);
    summary.updated.push(label);
  } else {
    summary.already.push(label);
  }
}

function run() {
  const summary = {
    updated: [],
    already: [],
    missing: [],
    quarantined: [],
    skipped: []
  };

  KNOWN_FILES.forEach(({ relPath, label }) => {
    const filePath = path.join(DATA_DIR, relPath);
    migrateFile(filePath, label, summary);
  });

  const parts = [];
  parts.push(`updated ${summary.updated.length}`);
  if (summary.updated.length) parts.push(`updated files: ${summary.updated.join(', ')}`);
  if (summary.quarantined.length) parts.push(`quarantined ${summary.quarantined.length}`);
  if (summary.missing.length) parts.push(`missing ${summary.missing.length}`);
  if (summary.skipped.length) parts.push(`skipped ${summary.skipped.length}`);

  console.log(`Migration summary: ${parts.join('; ')}`);
}

run();
