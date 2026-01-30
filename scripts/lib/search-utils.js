const fs = require('fs');
const path = require('path');

const ID_PATTERNS = [
  /\bPTI\d{4,}-\d+\b/gi,
  /\bINC\d+\b/gi,
  /\bCHG\d+\b/gi
];

const TEXT_EXTS = new Set(['.md', '.txt', '.log', '.json', '.yaml', '.yml']);

function extractIdTokens(query) {
  const tokens = new Set();
  const q = String(query || '');
  for (const re of ID_PATTERNS) {
    const matches = q.match(re);
    if (matches) {
      for (const m of matches) tokens.add(m.toUpperCase());
    }
  }
  return Array.from(tokens);
}

function tokenizeQuery(query) {
  const tokens = [];
  const q = String(query || '');
  const re = /[A-Za-z0-9_-]{2,}/g;
  let m;
  while ((m = re.exec(q)) !== null) {
    tokens.push(m[0]);
  }
  return tokens;
}

function listFilesRecursive(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      listFilesRecursive(full, files);
    } else if (ent.isFile()) {
      const ext = path.extname(ent.name).toLowerCase();
      if (TEXT_EXTS.has(ext)) files.push(full);
    }
  }
  return files;
}

function toDateString(ms) {
  try {
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  } catch {
    return '';
  }
}

function inferDateFromPath(filePath, mtimeMs) {
  const m = String(filePath).match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (m && m[1]) return m[1];
  return toDateString(mtimeMs);
}

function findFirstMatchIndex(textLower, needles) {
  let best = -1;
  for (const needle of needles) {
    if (!needle) continue;
    const idx = textLower.indexOf(needle);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  return best;
}

function buildSnippet(text, index, length) {
  if (index < 0) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > 220 ? clean.slice(0, 220) + '…' : clean;
  }
  const raw = String(text || '');
  const start = Math.max(0, index - 80);
  const end = Math.min(raw.length, index + length + 120);
  let snippet = raw.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < raw.length) snippet = snippet + '…';
  return snippet;
}

function scoreText(textLower, queryLower, tokensLower, idTokensLower) {
  let score = 0;
  if (queryLower && textLower.includes(queryLower)) score += 10;
  for (const t of tokensLower) {
    if (!t) continue;
    if (textLower.includes(t)) score += 2;
  }
  for (const id of idTokensLower) {
    if (!id) continue;
    if (textLower.includes(id)) score += 100;
  }
  return score;
}

function searchWorkspace(workspaceDir, query, opts = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const limit = Math.max(1, Math.min(20, Number(opts.limit || 8)));
  const maxSize = Math.max(1024, Number(opts.maxSize || 2 * 1024 * 1024));

  const targetDirs = [
    path.join(workspaceDir, 'logs', 'daily'),
    path.join(workspaceDir, 'data', 'tasks'),
    path.join(workspaceDir, 'data', 'Clients'),
    path.join(workspaceDir, 'docs', 'reports')
  ];

  const idTokens = extractIdTokens(q);
  const tokens = tokenizeQuery(q);
  const tokensLower = tokens.map((t) => t.toLowerCase());
  const idTokensLower = idTokens.map((t) => t.toLowerCase());
  const queryLower = q.toLowerCase();

  const results = [];
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = listFilesRecursive(dir, []);
    for (const file of files) {
      let st;
      try {
        st = fs.statSync(file);
      } catch {
        continue;
      }
      if (!st.isFile() || st.size > maxSize) continue;
      let text;
      try {
        text = fs.readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      if (!text || text.includes('\u0000')) continue;
      const textLower = text.toLowerCase();
      const score = scoreText(textLower, queryLower, tokensLower, idTokensLower);
      if (score <= 0) continue;

      const needles = [];
      if (queryLower) needles.push(queryLower);
      for (const t of tokensLower) needles.push(t);
      for (const id of idTokensLower) needles.push(id);
      const idx = findFirstMatchIndex(textLower, needles);
      const snippet = buildSnippet(text, idx, queryLower.length || 12);
      const relPath = path.relative(workspaceDir, file).replace(/\\/g, '/');
      const date = inferDateFromPath(relPath, st.mtimeMs);

      results.push({
        file: relPath,
        date,
        score,
        snippet
      });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  return results.slice(0, limit);
}

module.exports = {
  extractIdTokens,
  searchWorkspace
};
