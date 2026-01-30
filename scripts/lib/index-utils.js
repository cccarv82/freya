const fs = require('fs');
const path = require('path');

const ID_PATTERNS = [
  /\bPTI\d{4,}-\d+\b/gi,
  /\bINC\d+\b/gi,
  /\bCHG\d+\b/gi
];

const TEXT_EXTS = new Set(['.md', '.txt', '.log', '.json', '.yaml', '.yml']);
const TOKEN_RE = /[A-Za-z0-9_-]{3,}/g;

const DEFAULT_MAX_SIZE = 2 * 1024 * 1024;
const DEFAULT_TOKEN_LIMIT = 500;

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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function normalizeRelPath(workspaceDir, fullPath) {
  return path.relative(workspaceDir, fullPath).replace(/\\/g, '/');
}

function indexPathFor(workspaceDir) {
  return path.join(workspaceDir, 'data', 'index', 'search-index.json');
}

function listTargetFiles(workspaceDir) {
  const targetDirs = [
    path.join(workspaceDir, 'logs', 'daily'),
    path.join(workspaceDir, 'data', 'tasks'),
    path.join(workspaceDir, 'data', 'Clients'),
    path.join(workspaceDir, 'docs', 'reports')
  ];

  const files = [];
  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    const list = listFilesRecursive(dir, []);
    for (const file of list) {
      try {
        const st = fs.statSync(file);
        if (!st.isFile()) continue;
        files.push({ file, mtimeMs: st.mtimeMs });
      } catch {
        // ignore
      }
    }
  }
  return files;
}

function extractIdMatches(text) {
  const out = [];
  for (const re of ID_PATTERNS) {
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push({
        key: String(m[0]).toUpperCase(),
        index: m.index,
        length: String(m[0]).length
      });
    }
    re.lastIndex = 0;
  }
  return out;
}

function extractKeywordIndexMap(textLower, tokenLimit) {
  const map = new Map();
  let m;
  while ((m = TOKEN_RE.exec(textLower)) !== null) {
    const key = m[0];
    if (!map.has(key)) {
      map.set(key, m.index);
      if (map.size >= tokenLimit) break;
    }
  }
  TOKEN_RE.lastIndex = 0;
  return map;
}

function addEntry(entriesMap, key, relPath, date, snippet) {
  if (!entriesMap.has(key)) entriesMap.set(key, new Map());
  const fileMap = entriesMap.get(key);
  if (!fileMap.has(relPath)) {
    fileMap.set(relPath, { path: relPath, date, snippet });
  }
}

function removeFileFromEntries(entriesMap, relPath) {
  for (const [key, fileMap] of entriesMap.entries()) {
    if (fileMap.delete(relPath)) {
      if (fileMap.size === 0) entriesMap.delete(key);
    }
  }
}

function indexSingleFile(workspaceDir, file, mtimeMs, opts, entriesMap) {
  const maxSize = Math.max(1024, Number(opts.maxSize || DEFAULT_MAX_SIZE));
  const tokenLimit = Math.max(50, Number(opts.tokenLimit || DEFAULT_TOKEN_LIMIT));

  let st;
  try {
    st = fs.statSync(file);
  } catch {
    return;
  }
  if (!st.isFile() || st.size > maxSize) return;

  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return;
  }
  if (!text || text.includes('\u0000')) return;

  const relPath = normalizeRelPath(workspaceDir, file);
  const date = inferDateFromPath(relPath, mtimeMs);

  const idMatches = extractIdMatches(text);
  for (const match of idMatches) {
    const snippet = buildSnippet(text, match.index, match.length);
    addEntry(entriesMap, match.key, relPath, date, snippet);
  }

  const textLower = text.toLowerCase();
  const tokenMap = extractKeywordIndexMap(textLower, tokenLimit);
  for (const [token, index] of tokenMap.entries()) {
    if (!token) continue;
    const snippet = buildSnippet(text, index, token.length);
    addEntry(entriesMap, token, relPath, date, snippet);
  }
}

function entriesToMap(entries) {
  const map = new Map();
  if (!Array.isArray(entries)) return map;
  for (const entry of entries) {
    if (!entry || typeof entry.key !== 'string' || !Array.isArray(entry.files)) continue;
    const fileMap = new Map();
    for (const f of entry.files) {
      if (!f || typeof f.path !== 'string') continue;
      fileMap.set(f.path, {
        path: f.path,
        date: typeof f.date === 'string' ? f.date : '',
        snippet: typeof f.snippet === 'string' ? f.snippet : ''
      });
    }
    if (fileMap.size) map.set(entry.key, fileMap);
  }
  return map;
}

function mapToEntries(entriesMap) {
  const out = [];
  const keys = Array.from(entriesMap.keys()).sort();
  for (const key of keys) {
    const fileMap = entriesMap.get(key);
    const files = Array.from(fileMap.values());
    out.push({ key, files });
  }
  return out;
}

function readIndex(indexPath) {
  try {
    if (!fs.existsSync(indexPath)) return null;
    const raw = fs.readFileSync(indexPath, 'utf8');
    const json = JSON.parse(raw);
    if (!json || typeof json !== 'object') return null;
    return json;
  } catch {
    return null;
  }
}

function buildIndex(workspaceDir, opts = {}) {
  const entriesMap = new Map();
  const files = listTargetFiles(workspaceDir);

  for (const { file, mtimeMs } of files) {
    indexSingleFile(workspaceDir, file, mtimeMs, opts, entriesMap);
  }

  const metaFiles = {};
  for (const { file, mtimeMs } of files) {
    const relPath = normalizeRelPath(workspaceDir, file);
    metaFiles[relPath] = mtimeMs;
  }

  const index = {
    meta: {
      lastRun: new Date().toISOString(),
      files: metaFiles
    },
    entries: mapToEntries(entriesMap)
  };

  const indexPath = indexPathFor(workspaceDir);
  ensureDir(path.dirname(indexPath));
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');

  return { indexPath, fileCount: files.length, keyCount: index.entries.length };
}

function updateIndex(workspaceDir, opts = {}) {
  const indexPath = indexPathFor(workspaceDir);
  const currentFiles = listTargetFiles(workspaceDir);
  const currentMap = new Map();
  for (const { file, mtimeMs } of currentFiles) {
    const relPath = normalizeRelPath(workspaceDir, file);
    currentMap.set(relPath, { file, mtimeMs });
  }

  const existing = readIndex(indexPath);
  if (!existing || !existing.meta || !existing.meta.files || !Array.isArray(existing.entries)) {
    return buildIndex(workspaceDir, opts);
  }

  const entriesMap = entriesToMap(existing.entries);
  const prevFiles = existing.meta.files || {};

  const removed = new Set();
  for (const relPath of Object.keys(prevFiles)) {
    if (!currentMap.has(relPath)) removed.add(relPath);
  }

  const changed = [];
  for (const [relPath, info] of currentMap.entries()) {
    const prev = prevFiles[relPath];
    if (!prev || Number(prev) !== Number(info.mtimeMs)) {
      changed.push(info);
    }
  }

  for (const relPath of removed) {
    removeFileFromEntries(entriesMap, relPath);
  }

  for (const info of changed) {
    const relPath = normalizeRelPath(workspaceDir, info.file);
    removeFileFromEntries(entriesMap, relPath);
    indexSingleFile(workspaceDir, info.file, info.mtimeMs, opts, entriesMap);
  }

  const metaFiles = {};
  for (const [relPath, info] of currentMap.entries()) {
    metaFiles[relPath] = info.mtimeMs;
  }

  const index = {
    meta: {
      lastRun: new Date().toISOString(),
      files: metaFiles
    },
    entries: mapToEntries(entriesMap)
  };

  ensureDir(path.dirname(indexPath));
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n', 'utf8');

  return { indexPath, fileCount: currentFiles.length, keyCount: index.entries.length, changed: changed.length, removed: removed.size };
}

function searchIndex(workspaceDir, query, opts = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const limit = Math.max(1, Math.min(20, Number(opts.limit || 8)));

  const indexPath = indexPathFor(workspaceDir);
  const index = readIndex(indexPath);
  if (!index || !Array.isArray(index.entries)) return [];

  const entriesMap = new Map();
  for (const entry of index.entries) {
    if (!entry || typeof entry.key !== 'string' || !Array.isArray(entry.files)) continue;
    entriesMap.set(entry.key, entry.files);
  }

  const idTokens = extractIdTokens(q);
  const tokens = tokenizeQuery(q).map((t) => t.toLowerCase());
  const queryLower = q.toLowerCase();

  const resultsMap = new Map();

  function applyMatches(keys, weight) {
    for (const key of keys) {
      if (!key) continue;
      const entryFiles = entriesMap.get(key);
      if (!entryFiles) continue;
      for (const f of entryFiles) {
        if (!f || !f.path) continue;
        const prev = resultsMap.get(f.path) || { file: f.path, date: f.date || '', score: 0, snippet: '' , weight: 0 };
        const bonus = (key === queryLower) ? 10 : 0;
        const nextScore = prev.score + weight + bonus;
        const nextWeight = Math.max(prev.weight, weight);
        const snippet = (nextWeight > prev.weight && f.snippet) ? f.snippet : (prev.snippet || f.snippet || '');
        resultsMap.set(f.path, {
          file: f.path,
          date: f.date || prev.date || '',
          score: nextScore,
          snippet,
          weight: nextWeight
        });
      }
    }
  }

  applyMatches(idTokens.map((t) => t.toUpperCase()), 100);
  applyMatches(tokens, 2);

  const results = Array.from(resultsMap.values()).map((r) => {
    const { weight, ...rest } = r;
    return rest;
  });

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return String(b.date || '').localeCompare(String(a.date || ''));
  });

  return results.slice(0, limit);
}

module.exports = {
  buildIndex,
  updateIndex,
  searchIndex,
  indexPathFor
};
