#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function readJsonOrDefault(p, def) {
  try {
    if (!exists(p)) return def;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return def;
  }
}

function slugifyFileName(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\-_/ ]+/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-/]+|[-/]+$/g, '')
    .slice(0, 80) || 'note';
}

function yamlEscape(v) {
  const s = String(v == null ? '' : v);
  // quote always for safety
  return JSON.stringify(s);
}

function fmtTags(tags) {
  const uniq = Array.from(new Set(tags.filter(Boolean)));
  return '[' + uniq.map((t) => yamlEscape(t)).join(', ') + ']';
}

function writeNote(baseDir, relPathNoExt, md) {
  const outPath = path.join(baseDir, relPathNoExt + '.md');
  ensureDir(path.dirname(outPath));
  fs.writeFileSync(outPath, md, 'utf8');
  return outPath;
}

function main() {
  const workspaceDir = path.resolve(process.cwd());

  const blockersFile = path.join(workspaceDir, 'data', 'blockers', 'blocker-log.json');
  const tasksFile = path.join(workspaceDir, 'data', 'tasks', 'task-log.json');

  const blockersLog = readJsonOrDefault(blockersFile, { schemaVersion: 1, blockers: [] });
  const tasksLog = readJsonOrDefault(tasksFile, { schemaVersion: 1, tasks: [] });

  const blockers = Array.isArray(blockersLog.blockers) ? blockersLog.blockers : [];
  const tasks = Array.isArray(tasksLog.tasks) ? tasksLog.tasks : [];

  const notesRoot = path.join(workspaceDir, 'docs', 'notes');
  ensureDir(notesRoot);

  const created = [];

  // Export OPEN blockers as incident notes
  for (const b of blockers) {
    if (!b || typeof b !== 'object') continue;
    const status = String(b.status || '').toUpperCase();
    if (status !== 'OPEN' && status !== 'MITIGATING') continue;

    const title = String(b.title || '').trim();
    if (!title) continue;

    const projectSlug = String(b.projectSlug || '').trim();
    const sev = String(b.severity || '').toUpperCase();

    const tags = [];
    if (projectSlug) projectSlug.split('/').forEach((p) => tags.push(p));
    if (sev) tags.push(sev.toLowerCase());
    tags.push('blocker');

    const relBase = projectSlug ? path.join('incidents', projectSlug) : path.join('incidents', 'unclassified');
    const fileBase = slugifyFileName(title);
    const relPath = path.join(relBase, fileBase);

    const md = [
      '---',
      `type: ${yamlEscape('incident')}`,
      `id: ${yamlEscape(b.id || '')}`,
      `title: ${yamlEscape(title)}`,
      `status: ${yamlEscape(status)}`,
      `severity: ${yamlEscape(sev || '')}`,
      `projectSlug: ${yamlEscape(projectSlug)}`,
      `createdAt: ${yamlEscape(b.createdAt || '')}`,
      `tags: ${fmtTags(tags.map((t) => '#' + String(t).replace(/^#/, '')))}`,
      '---',
      '',
      `# ${title}`,
      '',
      b.description ? `## Context\n${String(b.description).trim()}\n` : '',
      b.nextAction ? `## Next action\n${String(b.nextAction).trim()}\n` : '',
      '',
      '## Links',
      '- Related reports: see `docs/reports/`',
      '- Related tasks: see `data/tasks/task-log.json`',
      ''
    ].filter(Boolean).join('\n');

    const out = writeNote(notesRoot, relPath, md);
    created.push(out);
  }

  // Export a daily index note (lightweight)
  const today = new Date().toISOString().slice(0, 10);
  const dailyNote = [
    '---',
    `type: ${yamlEscape('daily-index')}`,
    `date: ${yamlEscape(today)}`,
    '---',
    '',
    `# Daily Index ${today}`,
    '',
    '## Open blockers',
    ...blockers
      .filter((b) => b && (String(b.status || '').toUpperCase() === 'OPEN' || String(b.status || '').toUpperCase() === 'MITIGATING'))
      .slice(0, 20)
      .map((b) => {
        const ps = b.projectSlug ? ` [${b.projectSlug}]` : '';
        return `- ${String(b.title || '').trim()}${ps}`;
      }),
    '',
    '## DO_NOW tasks',
    ...tasks
      .filter((t) => t && String(t.status || '').toUpperCase() === 'PENDING' && String(t.category || '') === 'DO_NOW')
      .slice(0, 20)
      .map((t) => {
        const ps = t.projectSlug ? ` [${t.projectSlug}]` : '';
        return `- [ ] ${String(t.description || '').trim()}${ps}`;
      }),
    ''
  ].join('\n');

  const dailyOut = writeNote(notesRoot, path.join('daily', today), dailyNote);
  created.push(dailyOut);

  process.stdout.write(JSON.stringify({ ok: true, created: created.map((p) => path.relative(workspaceDir, p).replace(/\\/g, '/')) }, null, 2) + '\n');
}

main();
