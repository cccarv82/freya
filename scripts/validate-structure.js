const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOGS_DIR = path.join(ROOT, 'logs', 'daily');
const DATA_DIR = path.join(ROOT, 'data');
const DOCS_DIR = path.join(ROOT, 'docs');
const CLIENTS_DIR = path.join(DATA_DIR, 'Clients');

const errors = [];

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function walk(dir, out = []) {
  if (!exists(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function parseFrontmatter(text) {
  if (!text) return null;
  const lines = text.split(/\r?\n/);
  if (!lines.length || lines[0].trim() !== '---') return null;
  const fm = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    fm[key] = value;
  }
  return fm;
}

function validateDailyLogs() {
  if (!exists(LOGS_DIR)) return;
  const files = fs.readdirSync(LOGS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f));

  for (const name of files) {
    const full = path.join(LOGS_DIR, name);
    const body = readFileSafe(full);
    const fm = parseFrontmatter(body);
    const date = name.replace(/\.md$/, '');
    if (!fm) {
      errors.push(`Daily log missing frontmatter: ${path.relative(ROOT, full)}`);
      continue;
    }
    const type = String(fm.Type || '').toLowerCase();
    const fmDate = String(fm.Date || '').trim();
    if (type !== 'daily') {
      errors.push(`Daily log frontmatter Type must be 'daily': ${path.relative(ROOT, full)}`);
    }
    if (fmDate !== date) {
      errors.push(`Daily log frontmatter Date must match filename (${date}): ${path.relative(ROOT, full)}`);
    }
  }
}

function collectProjectSlugs() {
  if (!exists(CLIENTS_DIR)) return [];
  const slugs = [];
  const files = walk(CLIENTS_DIR).filter((f) => f.endsWith('status.json'));
  for (const file of files) {
    const rel = path.relative(CLIENTS_DIR, path.dirname(file));
    if (!rel) continue;
    const slug = rel.split(path.sep).join('/').toLowerCase();
    slugs.push(slug);
  }
  return Array.from(new Set(slugs));
}

function validateProjectStatusHistory() {
  if (!exists(CLIENTS_DIR)) return;
  const files = walk(CLIENTS_DIR).filter((f) => f.endsWith('status.json'));
  for (const file of files) {
    const raw = readFileSafe(file);
    if (!raw) continue;
    try {
      const json = JSON.parse(raw);
      if (!Array.isArray(json.history)) {
        errors.push(`status.json must include history array: ${path.relative(ROOT, file)}`);
      }
    } catch (e) {
      errors.push(`Invalid JSON in status.json: ${path.relative(ROOT, file)}`);
    }
  }
}

function validateTaskProjectSlugs() {
  const slugs = collectProjectSlugs();
  if (!slugs.length) return; // no known slugs -> skip

  const taskFile = path.join(DATA_DIR, 'tasks', 'task-log.json');
  if (!exists(taskFile)) return;

  let json;
  try { json = JSON.parse(readFileSafe(taskFile) || '{}'); } catch { return; }
  const tasks = Array.isArray(json.tasks) ? json.tasks : [];

  for (const task of tasks) {
    if (!task || typeof task !== 'object') continue;
    const desc = String(task.description || '').toLowerCase();
    if (!desc) continue;
    const mentioned = slugs.find((slug) => desc.includes(slug));
    if (mentioned && !task.projectSlug) {
      errors.push(`Task missing projectSlug for mentioned project (${mentioned}): ${task.id || task.description}`);
    }
  }
}

function validateDocsHubs() {
  const hubs = [
    path.join(DOCS_DIR, 'reports', 'Reports Hub.md'),
    path.join(DOCS_DIR, 'career', 'Career Hub.md'),
    path.join(DOCS_DIR, 'standards', 'Standards Hub.md'),
  ];
  for (const hub of hubs) {
    if (!exists(hub)) {
      errors.push(`Missing hub doc: ${path.relative(ROOT, hub)}`);
    }
  }
}

function main() {
  validateDailyLogs();
  validateProjectStatusHistory();
  validateTaskProjectSlugs();
  validateDocsHubs();

  if (errors.length) {
    console.error('❌ Structure validation failed:');
    for (const err of errors) console.error('-', err);
    process.exit(1);
  }
  console.log('✅ Structure validation passed');
}

main();
