'use strict';

const fs = require('fs');
const path = require('path');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  mkdirp(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function copyFile(src, dest, force) {
  if (exists(dest) && !force) return { copied: false, skipped: true, reason: 'exists' };
  mkdirp(path.dirname(dest));
  fs.copyFileSync(src, dest);
  return { copied: true };
}

function isNonEmptyDir(dir) {
  try {
    const entries = fs.readdirSync(dir);
    // ignore common empty markers
    const meaningful = entries.filter((e) => e !== '.DS_Store');
    return meaningful.length > 0;
  } catch {
    return false;
  }
}

function copyDirRecursive(srcDir, destDir, force, summary, options = {}) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const src = path.join(srcDir, ent.name);
    const dest = path.join(destDir, ent.name);

    // Preserve user state by default
    if (ent.isDirectory()) {
      if (ent.name === 'data' && isNonEmptyDir(dest) && !options.forceData) {
        summary.skipped.push('data/**');
        continue;
      }
      if (ent.name === 'logs' && isNonEmptyDir(dest) && !options.forceLogs) {
        summary.skipped.push('logs/**');
        continue;
      }

      copyDirRecursive(src, dest, force, summary, options);
      continue;
    }

    if (ent.isFile()) {
      const res = copyFile(src, dest, force);
      if (res.copied) summary.copied.push(path.relative(destDir, dest));
      else summary.skipped.push(path.relative(destDir, dest));
    }
  }
}

function ensurePackageJson(targetDir, force, summary) {
  const pkgPath = path.join(targetDir, 'package.json');
  const existing = readJsonSafe(pkgPath);

  const scriptsToEnsure = {
    health: 'node scripts/validate-data.js && node scripts/validate-structure.js',
    migrate: 'node scripts/migrate-data.js',
    report: 'node scripts/generate-weekly-report.js',
    'sm-weekly': 'node scripts/generate-sm-weekly-report.js',
    daily: 'node scripts/generate-daily-summary.js',
    status: 'node scripts/generate-executive-report.js',
    blockers: 'node scripts/generate-blockers-report.js'
  };

  if (!existing) {
    const name = path.basename(targetDir);
    const pkg = {
      name,
      private: true,
      version: '0.0.0',
      description: 'F.R.E.Y.A workspace',
      scripts: scriptsToEnsure
    };
    writeJson(pkgPath, pkg);
    summary.created.push('package.json');
    return;
  }

  // Merge scripts (do not overwrite unless --force)
  existing.scripts = existing.scripts || {};
  for (const [k, v] of Object.entries(scriptsToEnsure)) {
    if (existing.scripts[k] && existing.scripts[k] !== v && !force) {
      summary.skipped.push(`package.json#scripts.${k}`);
      continue;
    }
    existing.scripts[k] = v;
  }

  writeJson(pkgPath, existing);
  summary.updated.push('package.json');
}

function formatInitSummary(summary, targetDir) {
  const lines = [];
  lines.push('FREYA workspace initialized.');
  lines.push(`Target: ${targetDir}`);
  lines.push('');
  lines.push(`Created: ${summary.created.length}`);
  lines.push(`Updated: ${summary.updated.length}`);
  lines.push(`Copied: ${summary.copied.length}`);
  lines.push(`Skipped: ${summary.skipped.length}`);
  lines.push('');
  lines.push('Next steps:');
  lines.push('- Run: npm run health');
  lines.push('- (If upgrading old data) Run: npm run migrate');
  return lines.join('\n');
}

async function initWorkspace({ targetDir, force, forceData = false, forceLogs = false }) {
  const templateDir = path.join(__dirname, '..', 'templates', 'base');
  if (!exists(templateDir)) throw new Error(`Missing template directory: ${templateDir}`);

  mkdirp(targetDir);

  const summary = { copied: [], created: [], updated: [], skipped: [] };

  // Copy template files (preserve data/logs by default)
  copyDirRecursive(templateDir, targetDir, force, summary, { forceData, forceLogs });

  // Ensure package.json has scripts
  ensurePackageJson(targetDir, force, summary);

  // Ensure logs folder exists (no daily file created)
  mkdirp(path.join(targetDir, 'logs', 'daily'));

  const output = formatInitSummary(summary, targetDir);
  return { output, summary };
}

async function cmdInit({ targetDir, force, forceData = false, forceLogs = false }) {
  const { output } = await initWorkspace({ targetDir, force, forceData, forceLogs });
  process.stdout.write(output + '\n');
  return { output };
}

module.exports = { cmdInit, initWorkspace };
