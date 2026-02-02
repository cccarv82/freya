'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { searchWorkspace } = require('../scripts/lib/search-utils');
const { searchIndex } = require('../scripts/lib/index-utils');
const { initWorkspace } = require('./init');

function readAppVersion() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  try {
    const json = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    if (json && typeof json.version === 'string' && json.version.trim() !== '') return json.version.trim();
  } catch {
    // Fall back below.
  }
  return 'unknown';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const APP_VERSION = readAppVersion();

const CHAT_ID_PATTERNS = [
  /\bPTI\d{4,}-\d+\b/gi,
  /\bINC\d+\b/gi,
  /\bCHG\d+\b/gi
];

function guessNpmCmd() {
  // We'll execute via cmd.exe on Windows for reliability.
  return process.platform === 'win32' ? 'npm' : 'npm';
}

function guessOpenCmd() {
  // Minimal cross-platform opener without extra deps
  if (process.platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', ''] };
  if (process.platform === 'darwin') return { cmd: 'open', args: [] };
  return { cmd: 'xdg-open', args: [] };
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function newestFile(dir, prefix) {
  if (!exists(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
    .map((f) => ({ f, p: path.join(dir, f) }))
    .filter((x) => {
      try {
        return fs.statSync(x.p).isFile();
      } catch {
        return false;
      }
    })
    .sort((a, b) => {
      try {
        return fs.statSync(b.p).mtimeMs - fs.statSync(a.p).mtimeMs;
      } catch {
        return 0;
      }
    });
  return files[0]?.p || null;
}

function settingsPath(workspaceDir) {
  return path.join(workspaceDir, 'data', 'settings', 'settings.json');
}

function readSettings(workspaceDir) {
  const p = settingsPath(workspaceDir);
  try {
    if (!exists(p)) return { discordWebhookUrl: '', teamsWebhookUrl: '' };
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      discordWebhookUrl: json.discordWebhookUrl || '',
      teamsWebhookUrl: json.teamsWebhookUrl || ''
    };
  } catch {
    return { discordWebhookUrl: '', teamsWebhookUrl: '' };
  }
}

function writeSettings(workspaceDir, settings) {
  const p = settingsPath(workspaceDir);
  ensureDir(path.dirname(p));
  const out = {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    discordWebhookUrl: settings.discordWebhookUrl || '',
    teamsWebhookUrl: settings.teamsWebhookUrl || ''
  };
  fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return out;
}

function projectSlugMapPath(workspaceDir) {
  return path.join(workspaceDir, 'data', 'settings', 'project-slug-map.json');
}

function readProjectSlugMap(workspaceDir) {
  const p = projectSlugMapPath(workspaceDir);
  try {
    if (!exists(p)) {
      ensureDir(path.dirname(p));
      const defaults = {
        schemaVersion: 1,
        updatedAt: new Date().toISOString(),
        rules: [
          { contains: 'fideliza', slug: 'vivo/fidelizacao' },
          { contains: 'bnpl', slug: 'vivo/bnpl' },
          { contains: 'dpgc', slug: 'vivo/bnpl/dpgc' },
          { contains: 'vivo+', slug: 'vivo/vivoplus' }
        ]
      };
      fs.writeFileSync(p, JSON.stringify(defaults, null, 2) + '\n', 'utf8');
      return defaults;
    }
    const json = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!json || !Array.isArray(json.rules)) return { schemaVersion: 1, rules: [] };
    return json;
  } catch {
    return { schemaVersion: 1, rules: [] };
  }
}

function inferProjectSlug(text, map) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return '';

  let base = '';
  const rules = (map && Array.isArray(map.rules)) ? map.rules : [];
  for (const r of rules) {
    if (!r) continue;
    const needle = String(r.contains || '').toLowerCase().trim();
    const slug = String(r.slug || '').trim();
    if (!needle || !slug) continue;
    if (t.includes(needle)) { base = slug; break; }
  }

  // CHG tags
  const chg = (t.match(/\bchg\s*0*\d{4,}\b/i) || [])[0];
  const chgNorm = chg ? chg.toLowerCase().replace(/\s+/g, '') : '';

  // If no base but looks like Vivo context, at least prefix vivo
  if (!base && (t.includes('vivo') || t.includes('vivo+'))) base = 'vivo';

  if (base && chgNorm) {
    // keep numeric id
    const id = chgNorm.replace(/[^0-9]/g, '');
    if (id) base = base.replace(/\/+$/g, '') + '/chg' + id;
  }

  return base;
}

function listReports(workspaceDir) {
  const dir = path.join(workspaceDir, 'docs', 'reports');
  if (!exists(dir)) return [];

  const files = fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((name) => {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      return { name, full, mtimeMs: st.mtimeMs, size: st.size };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  function kind(name) {
    if (name.startsWith('executive-')) return 'executive';
    if (name.startsWith('sm-weekly-')) return 'sm-weekly';
    if (name.startsWith('blockers-')) return 'blockers';
    if (name.startsWith('daily-')) return 'daily';
    return 'other';
  }

  return files.map((f) => ({
    kind: kind(f.name),
    name: f.name,
    relPath: path.relative(workspaceDir, f.full).replace(/\\/g, '/'),
    mtimeMs: f.mtimeMs,
    size: f.size
  }));
}

function extractTitleFromMarkdown(md) {
  const t = String(md || '');
  const m = /^#\s+(.+)$/m.exec(t);
  if (m && m[1]) return m[1].trim();
  // fallback: first non-empty line
  const line = t.split(/\r?\n/).map((l) => l.trim()).find((l) => l);
  return line ? line.slice(0, 80) : 'Freya report';
}

function stripFirstH1(md) {
  const t = String(md || '');
  return t.replace(/^#\s+.+\r?\n/, '').trim();
}

function splitForEmbed(text, limit = 3900) {
  const t = String(text || '');
  if (t.length <= limit) return [t];
  const chunks = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(t.length, i + limit);
    // prefer splitting at newline
    const nl = t.lastIndexOf('\n', end);
    if (nl > i + 200) end = nl;
    chunks.push(t.slice(i, end));
    i = end;
  }
  return chunks;
}

function splitForDiscord(text, limit = 1900) {
  const t = String(text || '');
  if (t.length <= limit) return [t];

  const NL = String.fromCharCode(10);
  const NL2 = NL + NL;

  const parts = [];
  let i = 0;
  while (i < t.length) {
    let end = Math.min(t.length, i + limit);
    const window = t.slice(i, end);
    const cut = window.lastIndexOf(NL2);
    const cut2 = window.lastIndexOf(NL);
    if (cut > 400) end = i + cut;
    else if (cut2 > 600) end = i + cut2;
    const chunk = t.slice(i, end).trim();
    if (chunk) parts.push(chunk);
    i = end;
  }
  return parts;
}

function postJson(url, bodyObj) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = JSON.stringify(bodyObj);
    const options = {
      method: 'POST',
      hostname: u.hostname,
      path: u.pathname + u.search,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const proto = u.protocol === 'https:' ? require('https') : require('http');
    const req2 = proto.request(options, (r2) => {
      const chunks = [];
      r2.on('data', (c) => chunks.push(c));
      r2.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (r2.statusCode >= 200 && r2.statusCode < 300) return resolve({ ok: true, status: r2.statusCode, body: raw });
        return reject(new Error('Webhook error ' + r2.statusCode + ': ' + raw));
      });
    });
    req2.on('error', reject);
    req2.write(body);
    req2.end();
  });
}

function postDiscordWebhook(url, payload) {
  if (typeof payload === 'string') return postJson(url, { content: payload });
  return postJson(url, payload);
}

function postTeamsWebhook(url, text) {
  return postJson(url, { text });
}

function postTeamsCard(url, card) {
  return postJson(url, card);
}

function extractFirstJsonObject(text) {
  const t = String(text || '');
  const start = t.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let esc = false;

  for (let i = start; i < t.length; i++) {
    const ch = t[i];

    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    if (ch === '}') {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }

  return null;
}

function escapeJsonControlChars(jsonText) {
  // Replace unescaped control chars inside JSON string literals with safe escapes.
  // Handles Copilot outputs where newlines/tabs leak into string values.
  const out = [];
  let inString = false;
  let esc = false;

  for (let i = 0; i < jsonText.length; i++) {
    const ch = jsonText[i];
    const code = ch.charCodeAt(0);

    if (esc) {
      out.push(ch);
      esc = false;
      continue;
    }

    if (ch === '\\') {
      out.push(ch);
      esc = true;
      continue;
    }

    if (ch === '"') {
      out.push(ch);
      inString = !inString;
      continue;
    }

    if (inString) {
      if (code === 10) { out.push('\\n'); continue; }
      if (code === 13) { out.push('\\r'); continue; }
      if (code === 9) { out.push('\\t'); continue; }
      if (code >= 0 && code < 32) {
        const hex = code.toString(16).padStart(2, '0');
        out.push('\\u00' + hex);
        continue;
      }
    }

    out.push(ch);
  }

  return out.join('');
}

function scanSecrets(text) {
  const t = String(text || '');
  const findings = [];

  const rules = [
    { name: 'GitHub token (ghp_)', re: /ghp_[A-Za-z0-9]{20,}/g },
    { name: 'GitHub fine-grained token (github_pat_)', re: /github_pat_[A-Za-z0-9_]{20,}/g },
    { name: 'Slack token (xox*)', re: /xox[baprs]-[A-Za-z0-9-]{10,}/g },
    { name: 'AWS Access Key (AKIA)', re: /AKIA[0-9A-Z]{16}/g },
    { name: 'Private key block', re: /-----BEGIN [A-Z ]+PRIVATE KEY-----/g },
    { name: 'Discord webhook URL', re: /https?:\/\/(?:canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[^\s]+/g },
  ];

  for (const r of rules) {
    const m = t.match(r.re);
    if (m && m.length) findings.push({ rule: r.name, count: m.length });
  }

  // Basic heuristic: long high-entropy strings
  const long = t.match(/[A-Za-z0-9+\/=]{60,}/g);
  if (long && long.length) findings.push({ rule: 'High-entropy blob (heuristic)', count: long.length });

  return findings;
}

function redactSecrets(text) {
  let out = String(text || '');
  const replacements = [
    /ghp_[A-Za-z0-9]{20,}/g,
    /github_pat_[A-Za-z0-9_]{20,}/g,
    /xox[baprs]-[A-Za-z0-9-]{10,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /-----BEGIN [A-Z ]+PRIVATE KEY-----[sS]*?-----END [A-Z ]+PRIVATE KEY-----/g,
  ];
  for (const re of replacements) out = out.replace(re, '[REDACTED]');
  return out;
}

function debugLogPath(workspaceDir) {
  const dir = path.join(workspaceDir, '.debuglogs');
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, 'debug.jsonl');
}

function safeString(v, max = 2000) {
  const t = String(v == null ? '' : v);
  return t.length > max ? (t.slice(0, max) + '…') : t;
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const keys = Object.keys(payload);
  const summary = { keys };

  if (typeof payload.text === 'string') {
    const red = redactSecrets(payload.text);
    summary.textLen = payload.text.length;
    summary.textSha1 = sha1(red);
  }

  if (typeof payload.plan === 'string') {
    summary.planLen = payload.plan.length;
    summary.planSha1 = sha1(payload.plan);
  }

  if (typeof payload.webhookUrl === 'string') {
    summary.webhookHost = (() => { try { return new URL(payload.webhookUrl).host; } catch { return null; } })();
  }

  if (typeof payload.relPath === 'string') summary.relPath = payload.relPath;
  if (typeof payload.script === 'string') summary.script = payload.script;

  return summary;
}

function rotateDebugLog(filePath, maxBytes = 5 * 1024 * 1024) {
  try {
    if (!fs.existsSync(filePath)) return;
    const st = fs.statSync(filePath);
    if (st.size <= maxBytes) return;
    const dir = path.dirname(filePath);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotated = path.join(dir, 'debug-' + stamp + '.jsonl');
    fs.renameSync(filePath, rotated);
  } catch {}
}

function writeDebugEvent(workspaceDir, event) {
  try {
    if (!workspaceDir) return;
    const filePath = debugLogPath(workspaceDir);
    rotateDebugLog(filePath);
    const line = JSON.stringify({ ts: new Date().toISOString(), ...event });
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  } catch {}
}

async function publishRobust(webhookUrl, text, opts = {}) {
  const u = new URL(webhookUrl);
  const isDiscord = u.hostname.includes('discord.com') || u.hostname.includes('discordapp.com');

  const mode = String(opts.mode || 'chunks');

  if (mode === 'pretty') {
    const title = extractTitleFromMarkdown(text);
    const body = stripFirstH1(text);

    if (isDiscord) {
      const parts = splitForEmbed(body, 3900);
      for (let i = 0; i < parts.length; i++) {
        const payload = {
          embeds: [
            {
              title: i === 0 ? title : undefined,
              description: parts[i],
              color: 0x5865F2
            }
          ]
        };
        await postDiscordWebhook(webhookUrl, payload);
      }
      return { ok: true, chunks: parts.length, mode: 'pretty' };
    }

    // Teams (MessageCard)
    const card = {
      '@type': 'MessageCard',
      '@context': 'http://schema.org/extensions',
      summary: title,
      themeColor: '0078D7',
      title,
      text: body
    };
    await postTeamsCard(webhookUrl, card);
    return { ok: true, chunks: 1, mode: 'pretty' };
  }

  const chunks = isDiscord ? splitForDiscord(text, 1900) : splitForDiscord(text, 1800);

  for (const chunk of chunks) {
    if (isDiscord) await postDiscordWebhook(webhookUrl, chunk);
    else await postTeamsWebhook(webhookUrl, chunk);
  }

  return { ok: true, chunks: chunks.length, mode: 'chunks' };
}

function safeJson(res, code, obj) {
  const body = JSON.stringify(obj);

  try {
    const dbg = res && res.__freyaDebug;
    if (dbg && dbg.workspaceDir) {
      const error = obj && (obj.error || obj.details)
        ? safeString(redactSecrets(JSON.stringify({ error: obj.error, details: obj.details })), 1600)
        : null;
      writeDebugEvent(dbg.workspaceDir, {
        type: 'http_response',
        reqId: dbg.reqId,
        method: dbg.method,
        url: dbg.url,
        status: code,
        bytes: Buffer.byteLength(body),
        error
      });
    }
  } catch {}

  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function looksEmptyWorkspace(dir) {
  try {
    if (!exists(dir)) return true;
    const entries = fs.readdirSync(dir).filter((n) => !['.debuglogs', '.DS_Store'].includes(n));
    return entries.length === 0;
  } catch {
    return true;
  }
}

function looksLikeFreyaWorkspace(dir) {
  // minimal check: has scripts/validate-data.js and data/
  return (
    exists(path.join(dir, 'package.json')) &&
    exists(path.join(dir, 'scripts')) &&
    exists(path.join(dir, 'data'))
  );
}

function normalizeWorkspaceDir(inputDir) {
  const d = path.resolve(process.cwd(), inputDir);
  if (looksLikeFreyaWorkspace(d)) return d;

  // Common case: user picked parent folder that contains ./freya
  const child = path.join(d, 'freya');
  if (looksLikeFreyaWorkspace(child)) return child;

  return d;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function run(cmd, args, cwd) {
  return new Promise((resolve) => {
    let child;

    try {
      // On Windows, reliably execute CLI tools through cmd.exe.
      if (process.platform === 'win32' && (cmd === 'npx' || cmd === 'npm')) {
        const comspec = process.env.ComSpec || 'cmd.exe';
        child = spawn(comspec, ['/d', '/s', '/c', cmd, ...args], { cwd, shell: false, env: process.env });
      } else {
        child = spawn(cmd, args, { cwd, shell: false, env: process.env });
      }
    } catch (e) {
      return resolve({ code: 1, stdout: '', stderr: e.message || String(e) });
    }

    let stdout = '';
    let stderr = '';

    child.stdout && child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr && child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    // Prevent unhandled error event (e.g., ENOENT/EINVAL)
    child.on('error', (e) => {
      stderr += `\n${e.message || String(e)}`;
      resolve({ code: 1, stdout, stderr });
    });

    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

function isAllowedChatSearchPath(relPath) {
  if (!relPath) return false;
  if (relPath.startsWith('..')) return false;
  if (relPath.startsWith('data/chat/')) return false;
  return relPath.startsWith('data/') || relPath.startsWith('logs/') || relPath.startsWith('docs/');
}

function extractChatIds(text) {
  const tokens = new Set();
  const q = String(text || '');
  for (const re of CHAT_ID_PATTERNS) {
    const matches = q.match(re);
    if (matches) {
      for (const m of matches) tokens.add(m.toUpperCase());
    }
  }
  return Array.from(tokens);
}

function extractProjectToken(text) {
  const raw = String(text || '');
  const m = raw.match(/project\s*[:=]\s*([A-Za-z0-9_\/-]+)/i);
  if (m && m[1]) return m[1].trim();
  const m2 = raw.match(/project\s*\(([^)]+)\)/i);
  if (m2 && m2[1]) return m2[1].trim();
  return '';
}

function projectFromPath(relPath) {
  const p = String(relPath || '');
  const m = p.match(/data\/Clients\/([^/]+)\/([^/]+)/i);
  if (m && m[1] && m[2]) return `${m[1]}/${m[2]}`;
  return '';
}

function matchKey(m) {
  const ids = extractChatIds(`${m.file || ''} ${m.snippet || ''}`);
  if (ids.length) return `id:${ids[0]}`;
  const proj = projectFromPath(m.file) || extractProjectToken(`${m.file || ''} ${m.snippet || ''}`);
  if (proj) return `proj:${proj.toLowerCase()}`;
  return `file:${m.file || ''}`;
}

function mergeMatches(primary, secondary, limit = 8) {
  const list = [];
  const seen = new Set();
  const push = (m) => {
    if (!m || !m.file || !isAllowedChatSearchPath(m.file)) return;
    const key = matchKey(m);
    if (seen.has(key)) return;
    seen.add(key);
    list.push(m);
  };

  (primary || []).forEach(push);
  (secondary || []).forEach(push);

  const total = list.length;
  const trimmed = list.slice(0, Math.max(1, Math.min(20, limit)));
  return { matches: trimmed, total };
}

async function copilotSearch(workspaceDir, query, opts = {}) {
  const q = String(query || '').trim();
  if (!q) return { ok: false, error: 'Missing query' };

  const limit = Math.max(1, Math.min(20, Number(opts.limit || 8)));
  const cmd = process.env.COPILOT_CMD || 'copilot';

  const prompt = [
    'Você é um buscador local de arquivos.',
    'Objetivo: encontrar registros relevantes para a consulta do usuário.',
    'Escopo: procure SOMENTE nos diretórios data/, logs/ e docs/ do workspace.',
    'Exclua data/chat/ (conversa), a menos que o usuário peça explicitamente por chat.',
    'Use ferramentas para ler/consultar arquivos, mas não modifique nada.',
    `Consulta do usuário: "${q}"`,
    '',
    'Responda APENAS com JSON válido (sem code fences) no formato:',
    '{"answer":"<resposta humana, clara e direta>","evidence":[{"file":"<caminho relativo>","date":"YYYY-MM-DD ou vazio","detail":"<frase curta e única com a evidência>"}],"matches":[{"file":"<caminho relativo>","date":"YYYY-MM-DD ou vazio","snippet":"<trecho curto>"}]}',
    `Limite de matches: ${limit}.`,
    'A resposta deve soar humana, bem escrita, sem repetições, e mencionar a quantidade de registros encontrados.',
    'Priorize responder exatamente à pergunta (ex.: data e ID da última CHG).',
    'Na seção evidence, escreva evidências curtas e não repetidas (máx 5).',
    'A lista deve estar ordenada por relevância.'
  ].join('\n');

  const args = [
    '-s',
    '--no-color',
    '--stream',
    'off',
    '-p',
    prompt,
    '--allow-all-tools',
    '--add-dir',
    workspaceDir
  ];

  const r = await run(cmd, args, workspaceDir);
  const out = (r.stdout + r.stderr).trim();
  if (r.code !== 0) return { ok: false, error: out || 'Copilot returned non-zero exit code.' };

  const jsonText = extractFirstJsonObject(out) || out;
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    try {
      parsed = JSON.parse(escapeJsonControlChars(jsonText));
    } catch (e) {
      return { ok: false, error: e.message || 'Copilot output not valid JSON.' };
    }
  }

  const matchesRaw = Array.isArray(parsed.matches) ? parsed.matches : [];
  const matches = matchesRaw
    .map((m) => {
      const fileRaw = String(m && m.file ? m.file : '').trim();
      const dateRaw = String(m && m.date ? m.date : '').trim();
      const snippetRaw = String(m && m.snippet ? m.snippet : '').trim();
      let rel = fileRaw;
      if (fileRaw.startsWith(workspaceDir)) {
        rel = path.relative(workspaceDir, fileRaw).replace(/\\/g, '/');
      }
      return { file: rel.replace(/\\/g, '/'), date: dateRaw, snippet: snippetRaw };
    })
    .filter((m) => m.file && isAllowedChatSearchPath(m.file))
    .slice(0, limit);

  const evidenceRaw = Array.isArray(parsed.evidence) ? parsed.evidence : [];
  const evidence = evidenceRaw
    .map((m) => {
      const fileRaw = String(m && m.file ? m.file : '').trim();
      const dateRaw = String(m && m.date ? m.date : '').trim();
      const detailRaw = String(m && m.detail ? m.detail : '').trim();
      let rel = fileRaw;
      if (fileRaw.startsWith(workspaceDir)) {
        rel = path.relative(workspaceDir, fileRaw).replace(/\\/g, '/');
      }
      return { file: rel.replace(/\\/g, '/'), date: dateRaw, detail: detailRaw };
    })
    .filter((m) => m.file && m.detail && isAllowedChatSearchPath(m.file))
    .slice(0, 5);

  const answer = String(parsed.answer || '').trim();
  return { ok: true, answer, matches, evidence };
}

function buildChatAnswer(query, matches, summary, evidence, answer, totalCount) {
  const count = typeof totalCount === 'number' ? totalCount : matches.length;
  let summaryText = String(summary || '').trim();
  let answerText = String(answer || '').trim();
  if (!answerText) {
    if (!summaryText) {
      if (count === 0) {
        summaryText = `Não encontrei registros relacionados a "${query}".`;
      } else {
        summaryText = `Encontrei ${count} registro(s) relacionados a "${query}".`;
      }
    }
    answerText = summaryText;
  }

  const lines = [];
  lines.push(`Encontrei ${count} registro(s).`);
  lines.push(`Resposta curta: ${answerText}`);

  const evidences = Array.isArray(evidence) && evidence.length
    ? evidence
    : matches.slice(0, 5).map((m) => ({ file: m.file, date: m.date, detail: m.snippet }));

  if (!evidences.length) return lines.join('\n');

  lines.push('');
  lines.push('Detalhes:');
  for (const m of evidences.slice(0, 5)) {
    const detail = (m.detail || m.snippet || '').toString().trim();
    if (!detail) continue;
    const meta = [];
    if (m.file) meta.push(m.file);
    if (m.date) meta.push(m.date);
    const suffix = meta.length ? ` (${meta.join(' · ')})` : '';
    lines.push(`- ${detail}${suffix}`);
  }

  return lines.join('\n');
}

function openBrowser(url) {
  const { cmd, args } = guessOpenCmd();
  try {
    spawn(cmd, [...args, url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // ignore
  }
}

async function pickDirectoryNative() {
  if (process.platform === 'win32') {
    // PowerShell FolderBrowserDialog
    const ps = [
      '-NoProfile',
      '-Command',
      [
        'Add-Type -AssemblyName System.Windows.Forms;',
        '$f = New-Object System.Windows.Forms.FolderBrowserDialog;',
        "$f.Description = 'Select your FREYA workspace folder';",
        '$f.ShowNewFolderButton = $true;',
        'if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }'
      ].join(' ')
    ];
    const r = await run('powershell', ps, process.cwd());
    if (r.code !== 0) throw new Error((r.stderr || r.stdout || '').trim() || 'Failed to open folder picker');
    const out = (r.stdout || '').trim();
    return out || null;
  }

  if (process.platform === 'darwin') {
    const r = await run('osascript', ['-e', 'POSIX path of (choose folder with prompt "Select your FREYA workspace folder")'], process.cwd());
    if (r.code !== 0) throw new Error((r.stderr || r.stdout || '').trim() || 'Failed to open folder picker');
    const out = (r.stdout || '').trim();
    return out || null;
  }

  // Linux: prefer zenity, then kdialog
  if (exists('/usr/bin/zenity') || exists('/bin/zenity') || exists('/usr/local/bin/zenity')) {
    const r = await run('zenity', ['--file-selection', '--directory', '--title=Select your FREYA workspace folder'], process.cwd());
    if (r.code !== 0) return null;
    return (r.stdout || '').trim() || null;
  }
  if (exists('/usr/bin/kdialog') || exists('/bin/kdialog') || exists('/usr/local/bin/kdialog')) {
    const r = await run('kdialog', ['--getexistingdirectory', '.', 'Select your FREYA workspace folder'], process.cwd());
    if (r.code !== 0) return null;
    return (r.stdout || '').trim() || null;
  }

  return null;
}

function html(defaultDir) {
  // Aesthetic: “clean workstation” — light-first UI inspired by modern productivity apps.
  const safeDefault = String(defaultDir || './freya').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return buildHtml(safeDefault, APP_VERSION);
}

function reportsHtml(defaultDir) {
  const safeDefault = String(defaultDir || './freya').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return buildReportsHtml(safeDefault, APP_VERSION);
}

function buildHtml(safeDefault, appVersion) {
  const safeVersion = escapeHtml(appVersion || 'unknown');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FREYA Web</title>
  <link rel="stylesheet" href="/app.css" />
</head>
<body>
  <div class="app">
    <div class="frame">
      <div class="shell">

        <aside class="rail">
          <div class="railTop">
            <div class="railLogo">F</div>
          </div>
          <div class="railNav">
            <button class="railBtn active" id="railDashboard" type="button" title="Dashboard">D</button>
            <button class="railBtn" id="railReports" type="button" title="Relatórios">R</button>
          </div>
          <div class="railBottom">
            <div class="railStatus" id="railStatus" title="status"></div>
          </div>
        </aside>

        <main class="center">
          <div class="topbar">
            <div class="brandLine">
              <span class="spark"></span>
              <div class="brandStack">
                <div class="brand">FREYA</div>
                <div class="brandSub">Assistente de status local-first</div>
              </div>
            </div>
            <div class="topActions">
              <span class="chip" id="chipVersion">v${safeVersion}</span>
              <span class="chip" id="chipPort">127.0.0.1:3872</span>
            </div>
          </div>

          <div class="centerBody">
            <section class="promptShell">
              <div class="promptBar">
                <div class="promptMeta">
                  <div class="promptTitle">Prompt</div>
                  <div id="status" class="small">pronto</div>
                </div>
                <textarea id="inboxText" rows="3" placeholder="Cole updates do dia (status, blockers, decisões, ideias) ou faça uma pergunta..."></textarea>
                <div class="promptActions">
                  <button class="btn primary" type="button" onclick="saveAndPlan()">Salvar + Processar (Agents)</button>
                  <button class="btn" type="button" onclick="runSuggestedReports()">Rodar relatórios sugeridos</button>
                  <button class="btn" type="button" onclick="askFreya()">Perguntar à Freya</button>
                </div>
                <div class="promptToggles">
                  <label class="toggleRow">
                    <input id="autoApply" type="checkbox" checked style="width:auto" onchange="toggleAutoApply()" />
                    Auto-apply plan
                  </label>
                  <label class="toggleRow">
                    <input id="autoRunReports" type="checkbox" style="width:auto" onchange="toggleAutoRunReports()" />
                    Auto-run suggested reports
                  </label>
                </div>
              </div>
            </section>

            <section class="utilityGrid" id="reportsSection">
              <div class="utilityCard">
                <div class="utilityHead">Área de trabalho</div>
                <div class="sidePath" id="sidePath">./freya</div>
                <div class="row" style="grid-template-columns: 1fr auto">
                  <input id="dir" placeholder="./freya" />
                  <button class="btn small" type="button" onclick="pickDir()">Browse</button>
                </div>
                <div class="stack" style="margin-top:10px">
                  <button class="btn" type="button" onclick="doUpdate()">Sincronizar workspace</button>
                  <button class="btn" type="button" onclick="doMigrate()">Migrar dados</button>
                </div>
                <div style="height:10px"></div>
                <div class="help"><b>Sync workspace</b>: atualiza scripts/templates/agents na pasta <code>freya</code> sem sobrescrever <code>data/</code> e <code>logs/</code>.</div>
                <div class="help"><b>Migrate data</b>: ajusta formatos/schemaVersion quando uma versão nova exige.</div>
              </div>

              <div class="utilityCard">
                <div class="utilityHead">Relatórios rápidos</div>
                <div class="cardsMini">
                  <button class="miniCard" type="button" onclick="runReport('status')"><span class="miniIcon">E</span><span>Executivo</span></button>
                  <button class="miniCard" type="button" onclick="runReport('sm-weekly')"><span class="miniIcon">S</span><span>SM semanal</span></button>
                  <button class="miniCard" type="button" onclick="runReport('blockers')"><span class="miniIcon warn">B</span><span>Bloqueios</span></button>
                  <button class="miniCard" type="button" onclick="runReport('daily')"><span class="miniIcon">D</span><span>Daily</span></button>
                </div>
                <div class="help" style="margin-top:8px">Clique para gerar e atualizar o preview/publicação.</div>
              </div>
            </section>

            <div class="centerHead">
              <div>
                <h1 style="margin:0">Seu dia em um painel</h1>
                <div class="subtitle">Workspaces, Hoje (tarefas/bloqueios), relatórios e preview. Use o painel da direita como um “chat” para capturar updates.</div>
              </div>
              <div class="statusLine">
                <span class="small" id="last"></span>
              </div>
            </div>

            <div class="midGrid">
              <section class="panel">
                <div class="panelHead">
                  <b>Hoje</b>
                  <div class="stack">
                    <button class="btn small" type="button" onclick="refreshToday()">Atualizar</button>
                  </div>
                </div>
                <div class="panelBody panelScroll">
                  <div class="small" style="margin-bottom:8px; opacity:.8">Fazer agora</div>
                  <div id="tasksList" style="display:grid; gap:8px"></div>
                  <div style="height:12px"></div>
                  <div class="small" style="margin-bottom:8px; opacity:.8">Bloqueios abertos</div>
                  <div id="blockersList" style="display:grid; gap:8px"></div>
                </div>
              </section>

              <section class="panel">
                <div class="panelHead">
                  <b>Relatórios</b>
                  <div class="stack">
                    <button class="btn small" type="button" onclick="refreshReports()">Atualizar</button>
                  </div>
                </div>
                <div class="panelBody panelScroll">
                  <input id="reportsFilter" placeholder="filter (ex: daily, executive, 2026-01-29)" style="width:100%; margin-bottom:10px" oninput="renderReportsList()" />
                  <div id="reportsList" style="display:grid; gap:8px"></div>
                  <div class="help">Últimos relatórios em <code>docs/reports</code>. Clique para abrir o preview.</div>
                </div>
              </section>

              <section class="panel midSpan">
                <div class="panelHead">
                  <b>Preview</b>
                  <div class="stack">
                    <button class="btn small" type="button" onclick="copyOut()">Copy</button>
                    <button class="btn small" type="button" onclick="applyPlan()">Apply plan</button>
                    <button class="btn small" type="button" onclick="copyPath()">Copy path</button>
                    <button class="btn small" type="button" onclick="openSelected()">Open file</button>
                    <button class="btn small" type="button" onclick="downloadSelected()">Download .md</button>
                    <button class="btn small" type="button" onclick="clearOut()">Clear</button>
                  </div>
                </div>
                <div class="panelBody">
                  <div id="reportPreview" class="log md" style="font-family: var(--sans);"></div>
                  <div class="help">O preview renderiza Markdown básico (headers, listas, code). O botão Copy copia o conteúdo completo.</div>
                </div>
              </section>
            </div>

            <details class="devDrawer" id="devDrawer">
              <summary>Developer (modo avançado)</summary>
              <div class="devBody">
                <div class="devGrid">
                  <div class="panel">
                    <div class="panelHead"><b>Configurações de publicação</b></div>
                    <div class="panelBody">
                      <label>Discord webhook URL</label>
                      <input id="discord" placeholder="https://discord.com/api/webhooks/..." />
                      <div style="height:10px"></div>

                      <label>Teams webhook URL</label>
                      <input id="teams" placeholder="https://..." />
                      <div class="help">Os webhooks ficam salvos na workspace em <code>data/settings/settings.json</code>.</div>

                      <div style="height:10px"></div>
                      <label style="display:flex; align-items:center; gap:10px; user-select:none; margin: 6px 0 12px 0">
                        <input id="prettyPublish" type="checkbox" checked style="width:auto" onchange="togglePrettyPublish()" />
                        Publicação bonita (cards/embeds)
                      </label>

                      <div class="stack">
                        <button class="btn" type="button" onclick="saveSettings()">Salvar configurações</button>
                        <button class="btn" type="button" onclick="publish('discord')">Publicar selecionado → Discord</button>
                        <button class="btn" type="button" onclick="publish('teams')">Publicar selecionado → Teams</button>
                      </div>
                    </div>
                  </div>

                  <div class="panel">
                    <div class="panelHead"><b>Slugs & Export</b></div>
                    <div class="panelBody">
                      <label>Regras de slug do projeto</label>
                      <textarea id="slugRules" rows="8" placeholder="{ \"rules\": [ { \"contains\": \"fideliza\", \"slug\": \"vivo/fidelizacao\" } ] }"></textarea>
                      <div class="help">Regras usadas pra inferir <code>projectSlug</code>. Formato JSON (objeto com <code>rules</code>).</div>
                      <div class="stack" style="margin-top:10px">
                        <button class="btn" type="button" onclick="reloadSlugRules()">Recarregar regras</button>
                        <button class="btn" type="button" onclick="saveSlugRules()">Salvar regras</button>
                        <button class="btn" type="button" onclick="exportObsidian()">Exportar notas (Obsidian)</button>
                      </div>
                    </div>
                  </div>

                  <div class="panel">
                    <div class="panelHead"><b>Debug</b></div>
                    <div class="panelBody">
                      <div class="help">Logs ficam em <code>logs/</code> e debug traces em <code>.debuglogs/</code> dentro da workspace.</div>
                      <div class="help">Use <b>Open file</b> / <b>Copy path</b> no Preview para abrir/compartilhar o relatório selecionado.</div>
                      <div class="stack" style="margin-top:10px">
                        <button class="btn" type="button" onclick="rebuildIndex()">Rebuild search index</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          </div>
        </main>

        <aside class="chatPane">
          <div class="chatHead">
            <div>
              <div class="chatTitle">Conversa</div>
              <div class="chatSub">Cole seus updates e deixe os Agents planejar/aplicar.</div>
            </div>
          </div>

          <div class="chatThread" id="chatThread">
            <div class="bubble assistant">
              <div class="bubbleMeta">FREYA</div>
              <div class="bubbleBody">Cole seus updates (status, blockers, decisões, ideias) e clique em <b>Save + Process</b>.</div>
            </div>
          </div>
        </aside>

      </div>
    </div>
  </div>

  <script>
    window.__FREYA_DEFAULT_DIR = "${safeDefault}";
  </script>
  <script src="/app.js"></script>
</body>
</html>`;
}

function buildReportsHtml(safeDefault, appVersion) {
  const safeVersion = escapeHtml(appVersion || 'unknown');
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FREYA Reports</title>
  <link rel="stylesheet" href="/app.css" />
</head>
<body data-page="reports">
  <div class="app">
    <div class="frame">
      <div class="shell">

        <aside class="rail">
          <div class="railTop">
            <div class="railLogo">F</div>
          </div>
          <div class="railNav">
            <button class="railBtn" id="railDashboard" type="button" title="Dashboard">D</button>
            <button class="railBtn active" id="railReports" type="button" title="Relatórios">R</button>
          </div>
          <div class="railBottom">
            <div class="railStatus" id="railStatus" title="status"></div>
          </div>
        </aside>

        <main class="center reportsPage" id="reportsPage">
          <div class="topbar">
            <div class="brandLine">
              <span class="spark"></span>
              <div class="brandStack">
                <div class="brand">FREYA</div>
                <div class="brandSub">Relatórios</div>
              </div>
            </div>
            <div class="topActions">
              <span class="chip" id="chipVersion">v${safeVersion}</span>
              <span class="chip" id="chipPort">127.0.0.1:3872</span>
            </div>
          </div>

          <div class="centerBody">
            <input id="dir" type="hidden" />

            <section class="reportsHeader">
              <div>
                <div class="reportsTitle">Relatórios</div>
                <div class="reportsSubtitle">Edite e refine seus relatórios com preview em Markdown.</div>
              </div>
              <div class="reportsActions">
                <button class="btn small" type="button" onclick="refreshReportsPage()">Atualizar</button>
              </div>
            </section>

            <section class="reportsTools">
              <input id="reportsFilter" placeholder="filtrar (ex: daily, executive, 2026-01-29)" oninput="renderReportsPage()" />
            </section>

            <section class="reportsGrid" id="reportsGrid"></section>
          </div>
        </main>

      </div>
    </div>
  </div>

  <script>
    window.__FREYA_DEFAULT_DIR = "${safeDefault}";
  </script>
  <script src="/app.js"></script>
</body>
</html>`;
}

async function renderReportPdf(markdown, title) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const pageSize = [595.28, 841.89];
  let page = pdfDoc.addPage(pageSize);
  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  const drawLine = (segments, size, indent = 0) => {
    const lineHeight = size * 1.35;
    if (y - lineHeight < margin) {
      page = pdfDoc.addPage(pageSize);
      y = height - margin;
    }
    let x = margin + indent;
    for (const seg of segments) {
      const font = seg.style === 'bold' ? fontBold : seg.style === 'italic' ? fontItalic : seg.style === 'mono' ? fontMono : fontRegular;
      page.drawText(seg.text, { x, y, size, font, color: rgb(0.1, 0.1, 0.1) });
      x += font.widthOfTextAtSize(seg.text, size);
    }
    y -= lineHeight;
  };

  const wrapSegments = (segments, size, indent = 0) => {
    const maxWidth = width - margin * 2 - indent;
    let line = [];
    let lineWidth = 0;

    const pushLine = () => {
      if (line.length) drawLine(line, size, indent);
      line = [];
      lineWidth = 0;
    };

    const addToken = (token) => {
      const font = token.style === 'bold' ? fontBold : token.style === 'italic' ? fontItalic : token.style === 'mono' ? fontMono : fontRegular;
      const w = font.widthOfTextAtSize(token.text, size);
      if (lineWidth + w > maxWidth && token.text.trim() !== '') {
        pushLine();
        if (token.text.trim() === '') return;
      }
      line.push(token);
      lineWidth += w;
    };

    for (const seg of segments) {
      const parts = seg.text.split(/(\s+)/);
      for (const p of parts) {
        if (p === '') continue;
        addToken({ text: p, style: seg.style });
      }
    }
    pushLine();
  };

  const parseInline = (text) => {
    const chunks = [];
    const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
    let last = 0;
    const str = String(text || '');
    let m;
    while ((m = pattern.exec(str)) !== null) {
      if (m.index > last) chunks.push({ text: str.slice(last, m.index), style: 'normal' });
      const token = m[0];
      if (token.startsWith('**') || token.startsWith('__')) chunks.push({ text: token.slice(2, -2), style: 'bold' });
      else chunks.push({ text: token.slice(1, -1), style: 'italic' });
      last = m.index + token.length;
    }
    if (last < str.length) chunks.push({ text: str.slice(last), style: 'normal' });
    return chunks;
  };

  const lines = String(markdown || '').split(/\r?\n/);
  let inCode = false;
  for (const rawLine of lines) {
    const line = String(rawLine || '');
    if (line.trim().startsWith('```')) {
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      wrapSegments([{ text: line, style: 'mono' }], 10);
      continue;
    }

    if (line.trim() === '') {
      y -= 8;
      continue;
    }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const lvl = h[1].length;
      const size = lvl === 1 ? 18 : lvl === 2 ? 15 : 13;
      const segs = parseInline(h[2]).map((s) => ({ text: s.text, style: 'bold' }));
      wrapSegments(segs, size);
      continue;
    }

    const li = line.match(/^[ \t]*[-*]\s+(.*)$/);
    if (li) {
      const segs = [{ text: '• ', style: 'normal' }, ...parseInline(li[1])];
      wrapSegments(segs, 11, 12);
      continue;
    }

    wrapSegments(parseInline(line), 11);
  }

  return await pdfDoc.save();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function isoNow() {
  return new Date().toISOString();
}

function daysAgoIso(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function readJsonOrNull(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writeJson(p, obj) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function looksLikeDevSeed(json) {
  if (!json || typeof json !== 'object') return false;
  // Heuristic: any id ends with demo marker or source is dev-seed
  const dump = JSON.stringify(json);
  return dump.includes('dev-seed') || dump.includes('t-demo-') || dump.includes('b-demo-') || dump.includes('c-demo-');
}

function seedDevWorkspace(workspaceDir) {
  // Safe by default:
  // - create missing demo files
  // - if file exists and looks like prior dev-seed, upgrade it to richer demo
  ensureDir(path.join(workspaceDir, 'data', 'tasks'));
  ensureDir(path.join(workspaceDir, 'data', 'career'));
  ensureDir(path.join(workspaceDir, 'data', 'blockers'));
  ensureDir(path.join(workspaceDir, 'data', 'Clients', 'acme', 'rocket'));
  ensureDir(path.join(workspaceDir, 'data', 'Clients', 'vivo', '5g'));
  ensureDir(path.join(workspaceDir, 'logs', 'daily'));

  const taskLog = path.join(workspaceDir, 'data', 'tasks', 'task-log.json');
  const taskExisting = readJsonOrNull(taskLog);
  if (!exists(taskLog) || looksLikeDevSeed(taskExisting)) {
    writeJson(taskLog, {
      schemaVersion: 1,
      tasks: [
        // Completed in last 7 days
        { id: 't-demo-ship-1', description: 'Publicar pacote @cccarv82/freya no npm (CI)', category: 'DO_NOW', status: 'COMPLETED', createdAt: daysAgoIso(6), completedAt: daysAgoIso(5), priority: 'high', projectSlug: 'acme-rocket' },
        { id: 't-demo-ship-2', description: 'Adicionar UI web local (freya web)', category: 'DO_NOW', status: 'COMPLETED', createdAt: daysAgoIso(4), completedAt: daysAgoIso(3), priority: 'high', projectSlug: 'acme-rocket' },
        { id: 't-demo-ship-3', description: 'Corrigir publish via npm token/2FA', category: 'DO_NOW', status: 'COMPLETED', createdAt: daysAgoIso(3), completedAt: daysAgoIso(2), priority: 'medium' },
        // Pending
        { id: 't-demo-now-1', description: 'Refinar UI/UX do painel web (layout + preview)', category: 'DO_NOW', status: 'PENDING', createdAt: daysAgoIso(1), priority: 'high' },
        { id: 't-demo-now-2', description: 'Melhorar publish no Teams (cards + chunks)', category: 'DO_NOW', status: 'PENDING', createdAt: daysAgoIso(1), priority: 'medium' },
        { id: 't-demo-schedule-1', description: 'Criar modo "freya web" com preview Markdown', category: 'SCHEDULE', status: 'PENDING', createdAt: daysAgoIso(0), priority: 'medium' },
        { id: 't-demo-delegate-1', description: 'Pedir feedback de 3 usuários beta (UX)', category: 'DELEGATE', status: 'PENDING', createdAt: daysAgoIso(0), priority: 'low' }
      ]
    });
  }

  const careerLog = path.join(workspaceDir, 'data', 'career', 'career-log.json');
  const careerExisting = readJsonOrNull(careerLog);
  if (!exists(careerLog) || looksLikeDevSeed(careerExisting)) {
    writeJson(careerLog, {
      schemaVersion: 1,
      entries: [
        { id: 'c-demo-1', date: daysAgoIso(6).slice(0, 10), type: 'Achievement', description: 'Estruturou pipeline de publicação npm com tags e NPM_TOKEN', tags: ['devops', 'release'], source: 'dev-seed' },
        { id: 'c-demo-2', date: daysAgoIso(4).slice(0, 10), type: 'Feedback', description: 'Feedback: “Setup via npx ficou ridiculamente simples.”', tags: ['product', 'ux'], source: 'dev-seed' },
        { id: 'c-demo-3', date: daysAgoIso(2).slice(0, 10), type: 'Achievement', description: 'Entregou modo web local com geração de relatórios e publish.', tags: ['shipping', 'frontend'], source: 'dev-seed' },
        { id: 'c-demo-4', date: daysAgoIso(1).slice(0, 10), type: 'Goal', description: 'Validar o produto com 5 times e transformar em serviço B2B.', tags: ['business'], source: 'dev-seed' }
      ]
    });
  }

  const blockerLog = path.join(workspaceDir, 'data', 'blockers', 'blocker-log.json');
  const blockerExisting = readJsonOrNull(blockerLog);
  if (!exists(blockerLog) || looksLikeDevSeed(blockerExisting)) {
    writeJson(blockerLog, {
      schemaVersion: 1,
      blockers: [
        { id: 'b-demo-crit-1', title: 'Spawn EINVAL no Windows ao rodar npx via server', description: 'Ajustar execução via cmd.exe /c', createdAt: daysAgoIso(2), status: 'RESOLVED', severity: 'CRITICAL', resolvedAt: daysAgoIso(1), nextAction: 'Validar em ambiente real' },
        { id: 'b-demo-high-1', title: 'Teams webhook truncando mensagens longas', description: 'Implementar chunking + cards', createdAt: daysAgoIso(1), status: 'OPEN', severity: 'HIGH', nextAction: 'Dividir em blocos e enviar sequencialmente' },
        { id: 'b-demo-med-1', title: 'Preview Markdown no web (render)', description: 'Adicionar render de Markdown no front', createdAt: daysAgoIso(1), status: 'MITIGATING', severity: 'MEDIUM', nextAction: 'Render simples (headers/lists/code) sem deps' },
        { id: 'b-demo-low-1', title: 'Polish: remover duplicações na UI', description: 'Consolidar ações na sidebar ou na página', createdAt: daysAgoIso(0), status: 'OPEN', severity: 'LOW' }
      ]
    });
  }

  // Project statuses
  const projectStatus1 = path.join(workspaceDir, 'data', 'Clients', 'acme', 'rocket', 'status.json');
  const ps1 = readJsonOrNull(projectStatus1);
  if (!exists(projectStatus1) || looksLikeDevSeed(ps1)) {
    writeJson(projectStatus1, {
      schemaVersion: 1,
      client: 'Acme',
      project: 'Rocket',
      currentStatus: 'Green — progressing as planned',
      lastUpdated: daysAgoIso(0),
      active: true,
      history: [
        { date: daysAgoIso(6), type: 'Decision', content: 'Adotar publish via tags vX.Y.Z no GitHub', source: 'dev-seed' },
        { date: daysAgoIso(4), type: 'Status', content: 'Painel web MVP subiu localmente (freya web)', source: 'dev-seed' },
        { date: daysAgoIso(2), type: 'Risk', content: 'Windows spawn issues ao chamar npx (corrigir)', source: 'dev-seed' },
        { date: daysAgoIso(1), type: 'Status', content: 'Correções de compatibilidade Windows + auto-seed', source: 'dev-seed' },
        { date: daysAgoIso(0), type: 'Status', content: 'UI redesign inspirado em apps modernos (tema claro + toggle)', source: 'dev-seed' }
      ]
    });
  }

  const projectStatus2 = path.join(workspaceDir, 'data', 'Clients', 'vivo', '5g', 'status.json');
  const ps2 = readJsonOrNull(projectStatus2);
  if (!exists(projectStatus2) || looksLikeDevSeed(ps2)) {
    writeJson(projectStatus2, {
      schemaVersion: 1,
      client: 'Vivo',
      project: '5G',
      currentStatus: 'Amber — dependency on vendor payload format',
      lastUpdated: daysAgoIso(1),
      active: true,
      history: [
        { date: daysAgoIso(5), type: 'Status', content: 'Integração inicial concluída; aguardando webhook do Teams', source: 'dev-seed' },
        { date: daysAgoIso(3), type: 'Blocker', content: 'Falha intermitente no webhook em ambiente com 2FA', source: 'dev-seed' },
        { date: daysAgoIso(1), type: 'Decision', content: 'Implementar chunking e fallback de publish', source: 'dev-seed' }
      ]
    });
  }

  // Daily logs: create today and yesterday if missing
  const today = isoDate();
  const yesterday = isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000));

  const daily1 = path.join(workspaceDir, 'logs', 'daily', `${yesterday}.md`);
  if (!exists(daily1)) {
    fs.writeFileSync(
      daily1,
      `# Daily Log ${yesterday}\n\n## [09:10] Raw Input\nHoje preciso melhorar a UX do web e destravar publish no Teams.\n\n## [11:25] Raw Input\nEstou travado no payload do Teams; vou dividir mensagens em chunks.\n\n## [18:05] Raw Input\nTerminei a correção do Windows (spawn) e rodei testes.\n`,
      'utf8'
    );
  }

  const daily2 = path.join(workspaceDir, 'logs', 'daily', `${today}.md`);
  if (!exists(daily2)) {
    fs.writeFileSync(
      daily2,
      `# Daily Log ${today}\n\n## [09:05] Raw Input\nReunião com Acme: projeto Rocket verde, foco em polish do produto.\n\n## [14:20] Raw Input\nPreciso preparar update executivo e publicar no Discord.\n\n## [17:45] Raw Input\nFechei os blockers críticos e gerei relatório SM semanal.\n`,
      'utf8'
    );
  }

  return {
    seeded: true,
    paths: {
      taskLog,
      careerLog,
      blockerLog,
      projectStatus1,
      projectStatus2,
      daily1,
      daily2
    }
  };
}

async function cmdWeb({ port, dir, open, dev }) {
  const host = '127.0.0.1';

  const server = http.createServer(async (req, res) => {
    const reqId = Math.random().toString(16).slice(2) + Date.now().toString(16);
    res.__freyaDebug = { reqId, method: req.method, url: req.url || '' };
    try {
      if (!req.url) return safeJson(res, 404, { error: 'Not found' });

      if (req.method === 'GET' && req.url === '/') {
        try { res.__freyaDebug.workspaceDir = normalizeWorkspaceDir(dir || './freya'); } catch {}
        const body = html(dir || './freya');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(body);
        return;
      }

      if (req.method === 'GET' && req.url === '/reports') {
        try { res.__freyaDebug.workspaceDir = normalizeWorkspaceDir(dir || './freya'); } catch {}
        const body = reportsHtml(dir || './freya');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(body);
        return;
      }

      if (req.method === 'GET' && req.url === '/app.css') {
        const css = fs.readFileSync(path.join(__dirname, 'web-ui.css'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(css);
        return;
      }

      if (req.method === 'GET' && req.url === '/app.js') {
        const js = fs.readFileSync(path.join(__dirname, 'web-ui.js'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(js);
        return;
      }

      if (req.url.startsWith('/api/')) {
        const raw = await readBody(req);
        const payload = raw ? JSON.parse(raw) : {};

        const requestedDir = payload.dir || dir || './freya';
        const workspaceDir = normalizeWorkspaceDir(requestedDir);

        // debug logging (always on)
        try {
          res.__freyaDebug.workspaceDir = workspaceDir;
          writeDebugEvent(workspaceDir, {
            type: 'http_request',
            reqId,
            method: req.method,
            url: req.url,
            payload: summarizePayload(payload)
          });
        } catch {}

        if (req.url === '/api/pick-dir') {
          const picked = await pickDirectoryNative();
          return safeJson(res, 200, { dir: picked });
        }

        if (req.url === '/api/defaults') {
          const settings = readSettings(workspaceDir);
          const reports = listReports(workspaceDir).slice(0, 20);
          const workspaceOk = looksLikeFreyaWorkspace(workspaceDir);
          return safeJson(res, 200, { workspaceDir, workspaceOk, settings, reports });
        }

        if (req.url === '/api/settings/save') {
          const incoming = payload.settings || {};
          const saved = writeSettings(workspaceDir, incoming);
          return safeJson(res, 200, { ok: true, settings: { discordWebhookUrl: saved.discordWebhookUrl, teamsWebhookUrl: saved.teamsWebhookUrl } });
        }


        if (req.url === '/api/project-slug-map/get') {
          const map = readProjectSlugMap(workspaceDir);
          return safeJson(res, 200, { ok: true, map });
        }

        if (req.url === '/api/project-slug-map/save') {
          const map = payload.map;
          if (!map || typeof map !== 'object') return safeJson(res, 400, { error: 'Missing map' });
          if (!Array.isArray(map.rules)) return safeJson(res, 400, { error: 'map.rules must be an array' });

          // normalize + basic validation
          const rules = map.rules
            .map((r) => ({ contains: String(r.contains || '').trim(), slug: String(r.slug || '').trim() }))
            .filter((r) => r.contains && r.slug);

          const out = { schemaVersion: 1, updatedAt: new Date().toISOString(), rules };
          const p = projectSlugMapPath(workspaceDir);
          ensureDir(require('path').dirname(p));
          fs.writeFileSync(p, JSON.stringify(out, null, 2) + '\n', 'utf8');
          return safeJson(res, 200, { ok: true, map: out });
        }

        if (req.url === '/api/reports/list') {
          const reports = listReports(workspaceDir);
          return safeJson(res, 200, { reports });
        }

        if (req.url === '/api/reports/read') {
          const rel = payload.relPath;
          if (!rel) return safeJson(res, 400, { error: 'Missing relPath' });
          const full = path.join(workspaceDir, rel);
          if (!exists(full)) return safeJson(res, 404, { error: 'Report not found' });
          const text = fs.readFileSync(full, 'utf8');
          return safeJson(res, 200, { relPath: rel, text });
        }

        if (req.url === '/api/reports/resolve') {
          const rel = payload.relPath;
          if (!rel) return safeJson(res, 400, { error: 'Missing relPath' });
          const full = path.join(workspaceDir, rel);
          if (!exists(full)) return safeJson(res, 404, { error: 'Report not found' });
          return safeJson(res, 200, { relPath: rel, fullPath: full });
        }

        if (req.url === '/api/reports/pdf') {
          const rel = payload.relPath;
          if (!rel) return safeJson(res, 400, { error: 'Missing relPath' });
          const full = path.join(workspaceDir, rel);
          if (!exists(full)) return safeJson(res, 404, { error: 'Report not found' });

          const reportsDir = path.join(workspaceDir, 'docs', 'reports');
          const safeReportsDir = path.resolve(reportsDir);
          const safeFull = path.resolve(full);
          if (!safeFull.startsWith(safeReportsDir + path.sep)) {
            return safeJson(res, 400, { error: 'Invalid report path' });
          }

          const text = fs.readFileSync(safeFull, 'utf8');
          const pdfBytes = await renderReportPdf(text, path.basename(rel));
          res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${path.basename(rel).replace(/\.md$/i, '')}.pdf"`,
            'Cache-Control': 'no-store'
          });
          res.end(Buffer.from(pdfBytes));
          return;
        }

        if (req.url === '/api/reports/write') {
          const rel = payload.relPath;
          const text = payload.text;
          if (!rel) return safeJson(res, 400, { error: 'Missing relPath' });
          if (typeof text !== 'string') return safeJson(res, 400, { error: 'Missing text' });
          const reportsDir = path.join(workspaceDir, 'docs', 'reports');
          const full = path.join(workspaceDir, rel);
          const safeReportsDir = path.resolve(reportsDir);
          const safeFull = path.resolve(full);
          if (!safeFull.startsWith(safeReportsDir + path.sep)) {
            return safeJson(res, 400, { error: 'Invalid report path' });
          }
          if (!exists(safeFull)) return safeJson(res, 404, { error: 'Report not found' });
          fs.writeFileSync(safeFull, text, 'utf8');
          return safeJson(res, 200, { ok: true, relPath: rel });
        }

        if (req.url === '/api/inbox/add') {
          const text = String(payload.text || '').trim();
          if (!text) return safeJson(res, 400, { error: 'Missing text' });

          const d = isoDate();
          const file = path.join(workspaceDir, 'logs', 'daily', `${d}.md`);
          ensureDir(path.dirname(file));

          const stamp = new Date();
          const hh = String(stamp.getHours()).padStart(2, '0');
          const mm = String(stamp.getMinutes()).padStart(2, '0');

          const block = `\n\n## [${hh}:${mm}] Raw Input\n${text}\n`;
          fs.appendFileSync(file, block, 'utf8');

          return safeJson(res, 200, { ok: true, file: path.relative(workspaceDir, file).replace(/\\/g, '/'), appended: true });
        }

        if (req.url === '/api/agents/plan') {
          const text = String(payload.text || '').trim();
          if (!text) return safeJson(res, 400, { error: 'Missing text' });

          // Build planner prompt from agent rules.
          // Prefer rules inside the selected workspace, but fallback to packaged rules.
          const workspaceRulesBase = path.join(workspaceDir, '.agent', 'rules', 'freya');
          const packagedRulesBase = path.join(__dirname, '..', '.agent', 'rules', 'freya');
          const rulesBase = exists(workspaceRulesBase) ? workspaceRulesBase : packagedRulesBase;

          const files = [
            path.join(rulesBase, 'freya.mdc'),
            path.join(rulesBase, 'agents', 'master.mdc'),
            path.join(rulesBase, 'agents', 'ingestor.mdc'),
            path.join(rulesBase, 'agents', 'oracle.mdc'),
            path.join(rulesBase, 'agents', 'coach.mdc')
          ].filter(exists);

          const rulesText = files.map((p) => {
            const rel = path.relative(workspaceDir, p).replace(/\\/g, '/');
            return `\n\n---\nFILE: ${rel}\n---\n` + fs.readFileSync(p, 'utf8');
          }).join('');

          const schema = {
            actions: [
              { type: 'append_daily_log', text: '<string>' },
              { type: 'create_task', description: '<string>', priority: 'HIGH|MEDIUM|LOW', category: 'DO_NOW|SCHEDULE|DELEGATE|IGNORE', projectSlug: '<string optional>' },
              { type: 'create_blocker', title: '<string>', severity: 'CRITICAL|HIGH|MEDIUM|LOW', notes: '<string>', projectSlug: '<string optional>' },
              { type: 'suggest_report', name: 'daily|status|sm-weekly|blockers' },
              { type: 'oracle_query', query: '<string>' }
            ]
          };

          const prompt = `Você é o planner do sistema F.R.E.Y.A.\n\nContexto: vamos receber um input bruto do usuário e propor ações estruturadas.\nRegras: siga os arquivos de regras abaixo.\nSaída: retorne APENAS JSON válido no formato: ${JSON.stringify(schema)}\n\nRestrições:\n- NÃO use code fences (\`\`\`)\n- NÃO inclua texto extra antes/depois do JSON\n- NÃO use quebras de linha dentro de strings (transforme em uma frase única)\n\nREGRAS:${rulesText}\n\nINPUT DO USUÁRIO:\n${text}\n`;

          // Prefer COPILOT_CMD if provided, otherwise try 'copilot'
          const cmd = process.env.COPILOT_CMD || 'copilot';

          // Best-effort: if Copilot CLI isn't available, return 200 with an explanatory plan
          // so the UI can show actionable next steps instead of hard-failing.
          try {
            const r = await run(cmd, ['-s', '--no-color', '--stream', 'off', '-p', prompt, '--allow-all-tools'], workspaceDir);
            const out = (r.stdout + r.stderr).trim();
            if (r.code !== 0) {
              return safeJson(res, 200, {
                ok: false,
                plan: out || 'Copilot returned non-zero exit code.',
                hint: 'Copilot CLI needs to be installed and authenticated.'
              });
            }
            return safeJson(res, 200, { ok: true, plan: out });
          } catch (e) {
            return safeJson(res, 200, {
              ok: false,
              plan: `Copilot CLI não disponível (cmd: ${cmd}).\n\nPara habilitar:\n- Windows (winget): winget install GitHub.Copilot\n- npm: npm i -g @github/copilot\n\nDepois rode \"copilot\" uma vez e faça /login.`,
              details: e.message || String(e)
            });
          }
        }

        if (req.url === '/api/agents/preview') {
          const planRaw = String(payload.plan || '').trim();
          if (!planRaw) return safeJson(res, 400, { error: 'Missing plan' });

          const jsonText = extractFirstJsonObject(planRaw) || planRaw;
          let plan;
          try {
            plan = JSON.parse(jsonText);
          } catch (e) {
            try {
              plan = JSON.parse(escapeJsonControlChars(jsonText));
            } catch (e2) {
              return safeJson(res, 400, {
                error: 'Plan is not valid JSON',
                details: (e2 && e2.message) ? e2.message : (e && e.message ? e.message : String(e)),
                hint: 'O planner gerou caracteres de controle dentro de strings (ex.: quebra de linha). Reexecute o planner ou escape quebras de linha como \\n.'
              });
            }
          }

          const actions = Array.isArray(plan.actions) ? plan.actions : [];
          if (!Array.isArray(actions) || actions.length === 0) {
            return safeJson(res, 400, { error: 'Plan has no actions[]' });
          }

          // Validate + normalize to a safe preview shape
          const validTaskCats = new Set(['DO_NOW', 'SCHEDULE', 'DELEGATE', 'IGNORE']);
          const validSev = new Set(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

          const preview = { tasks: [], blockers: [], reportsSuggested: [], oracleQueries: [], ignored: 0, errors: [] };

          for (const a of actions) {
            if (!a || typeof a !== 'object') { preview.ignored++; continue; }
            const type = String(a.type || '').trim();

            if (type === 'create_task') {
              const description = normalizeWhitespace(a.description);
              const category = String(a.category || '').trim();
              const priorityRaw = String(a.priority || '').trim().toLowerCase();
              const priority = (priorityRaw === 'high' || priorityRaw === 'medium' || priorityRaw === 'low') ? priorityRaw : undefined;
              if (!description) { preview.errors.push('Task missing description'); continue; }
              const projectSlug = String(a.projectSlug || '').trim();
              preview.tasks.push({ description, category: validTaskCats.has(category) ? category : 'DO_NOW', priority, projectSlug: projectSlug || undefined });
              continue;
            }

            if (type === 'create_blocker') {
              const title = normalizeWhitespace(a.title);
              const notes = normalizeWhitespace(a.notes);
              let severity = String(a.severity || '').trim().toUpperCase();
              if (!validSev.has(severity)) {
                if (severity.includes('CRIT')) severity = 'CRITICAL';
                else if (severity.includes('HIGH')) severity = 'HIGH';
                else if (severity.includes('MED')) severity = 'MEDIUM';
                else if (severity.includes('LOW')) severity = 'LOW';
                else severity = 'MEDIUM';
              }
              if (!title) { preview.errors.push('Blocker missing title'); continue; }
              const projectSlug = String(a.projectSlug || '').trim();
              preview.blockers.push({ title, notes, severity, projectSlug: projectSlug || undefined });
              continue;
            }

            if (type === 'suggest_report') {
              const name = String(a.name || '').trim();
              if (name) preview.reportsSuggested.push(name);
              continue;
            }

            if (type === 'oracle_query') {
              const query = String(a.query || '').trim();
              if (query) preview.oracleQueries.push(query);
              continue;
            }

            preview.ignored++;
          }

          // Dedup suggested reports
          preview.reportsSuggested = Array.from(new Set(preview.reportsSuggested));
          preview.oracleQueries = Array.from(new Set(preview.oracleQueries));

          return safeJson(res, 200, { ok: true, preview });
        }

        if (req.url === '/api/agents/apply') {
          const planRaw = String(payload.plan || '').trim();
          if (!planRaw) return safeJson(res, 400, { error: 'Missing plan' });

          const jsonText = extractFirstJsonObject(planRaw) || planRaw;

          function errorSnippet(text, pos) {
            const p = Number.isFinite(pos) ? pos : 0;
            const start = Math.max(0, p - 60);
            const end = Math.min(text.length, p + 60);
            const slice = text.slice(start, end);
            const codes = Array.from(slice).map((ch) => ch.charCodeAt(0));
            return { start, end, slice, codes };
          }

          let plan;
          try {
            plan = JSON.parse(jsonText);
          } catch (e) {
            // Attempt repair for common control-character issues
            try {
              plan = JSON.parse(escapeJsonControlChars(jsonText));
            } catch (e2) {
              return safeJson(res, 400, {
                error: 'Plan is not valid JSON',
                details: (e2 && e2.message) ? e2.message : ((e && e.message) ? e.message : String(e)),
                hint: 'O planner gerou caracteres de controle dentro de strings (ex.: quebra de linha literal). Reexecute o planner; ou escape quebras de linha como \\n.',
                snippet: (() => {
                  const m2 = /position (\d+)/.exec(((e2 && e2.message) ? e2.message : ((e && e.message) ? e.message : '')));
                  const pos = m2 ? Number(m2[1]) : NaN;
                  return errorSnippet(jsonText, pos);
                })()
              });
            }
          }

          const actions = Array.isArray(plan.actions) ? plan.actions : [];
          if (!Array.isArray(actions) || actions.length === 0) {
            return safeJson(res, 400, { error: 'Plan has no actions[]' });
          }

          const taskFile = path.join(workspaceDir, 'data', 'tasks', 'task-log.json');
          const blockerFile = path.join(workspaceDir, 'data', 'blockers', 'blocker-log.json');

          const taskLog = readJsonOrNull(taskFile) || { schemaVersion: 1, tasks: [] };
          if (!Array.isArray(taskLog.tasks)) taskLog.tasks = [];
          if (typeof taskLog.schemaVersion !== 'number') taskLog.schemaVersion = 1;

          const blockerLog = readJsonOrNull(blockerFile) || { schemaVersion: 1, blockers: [] };
          if (!Array.isArray(blockerLog.blockers)) blockerLog.blockers = [];
          if (typeof blockerLog.schemaVersion !== 'number') blockerLog.schemaVersion = 1;

          function normalizeWhitespace(t) {
            return String(t || '').replace(/\s+/g, ' ').trim();
          }

          function normalizeTextForKey(t) {
            return normalizeWhitespace(t).toLowerCase();
          }

          function sha1(text) {
            return crypto.createHash('sha1').update(String(text || ''), 'utf8').digest('hex');
          }

          function within24h(iso) {
            try {
              const ms = Date.parse(iso);
              if (!Number.isFinite(ms)) return false;
              return (Date.now() - ms) <= 24 * 60 * 60 * 1000;
            } catch {
              return false;
            }
          }

          const existingTaskKeys24h = new Set(
            taskLog.tasks
              .filter((t) => t && within24h(t.createdAt))
              .map((t) => sha1(normalizeTextForKey(t.description)))
          );

          const existingBlockerKeys24h = new Set(
            blockerLog.blockers
              .filter((b) => b && within24h(b.createdAt))
              .map((b) => sha1(normalizeTextForKey(b.title)))
          );

          const now = new Date().toISOString();
          const applyMode = String(payload.mode || 'all').trim();
          const applied = { tasks: 0, blockers: 0, tasksSkipped: 0, blockersSkipped: 0, reportsSuggested: [], oracleQueries: [], mode: applyMode };
          const slugMap = readProjectSlugMap(workspaceDir);

          function makeId(prefix) {
            const rand = Math.random().toString(16).slice(2, 8);
            return `${prefix}-${Date.now()}-${rand}`;
          }

          function normPriority(p) {
            const v = String(p || '').trim().toLowerCase();
            if (v === 'high') return 'high';
            if (v === 'medium') return 'medium';
            if (v === 'low') return 'low';
            if (v === 'critical') return 'high';
            return undefined;
          }

          function normSeverity(s) {
            const v = String(s || '').trim().toUpperCase();
            if (v.includes('CRIT')) return 'CRITICAL';
            if (v.includes('HIGH')) return 'HIGH';
            if (v.includes('MED')) return 'MEDIUM';
            if (v.includes('LOW')) return 'LOW';
            return 'MEDIUM';
          }

          const validTaskCats = new Set(['DO_NOW', 'SCHEDULE', 'DELEGATE', 'IGNORE']);

          for (const a of actions) {
            if (!a || typeof a !== 'object') continue;
            const type = String(a.type || '').trim();

            if (type === 'create_task') {
              if (applyMode !== 'all' && applyMode !== 'tasks') continue;
              const description = normalizeWhitespace(a.description);
              if (!description) continue;
              const projectSlug = String(a.projectSlug || '').trim() || inferProjectSlug(description, slugMap);
              const key = sha1(normalizeTextForKey((projectSlug ? projectSlug + ' ' : '') + description));
              if (existingTaskKeys24h.has(key)) { applied.tasksSkipped++; continue; }
              const category = validTaskCats.has(String(a.category || '').trim()) ? String(a.category).trim() : 'DO_NOW';
              const priority = normPriority(a.priority);
              const task = {
                id: makeId('t'),
                description,
                category,
                status: 'PENDING',
                createdAt: now,
              };
              if (projectSlug) task.projectSlug = projectSlug;
              if (priority) task.priority = priority;
              taskLog.tasks.push(task);
              applied.tasks++;
              continue;
            }

            if (type === 'create_blocker') {
              if (applyMode !== 'all' && applyMode !== 'blockers') continue;
              const title = normalizeWhitespace(a.title);
              const projectSlug = String(a.projectSlug || '').trim() || inferProjectSlug(title + ' ' + normalizeWhitespace(a.notes), slugMap);
              const key = sha1(normalizeTextForKey((projectSlug ? projectSlug + ' ' : '') + title));
              if (existingBlockerKeys24h.has(key)) { applied.blockersSkipped++; continue; }
              const notes = normalizeWhitespace(a.notes);
              if (!title) continue;
              const severity = normSeverity(a.severity);
              const blocker = {
                id: makeId('b'),
                title,
                description: notes || title,
                createdAt: now,
                status: 'OPEN',
                severity,
              };
              if (projectSlug) blocker.projectSlug = projectSlug;
              blockerLog.blockers.push(blocker);
              applied.blockers++;
              continue;
            }

            if (type === 'suggest_report') {
              const name = String(a.name || '').trim();
              if (name) applied.reportsSuggested.push(name);
              continue;
            }

            if (type === 'oracle_query') {
              const query = String(a.query || '').trim();
              if (query) applied.oracleQueries.push(query);
              continue;
            }
          }

          // Auto-suggest reports when planner didn't include any
          // (keeps UX consistent: if you created a blocker, at least suggest blockers)
          if (!applied.reportsSuggested.length) {
            const sug = [];
            sug.push('daily');
            if (applied.blockers > 0) sug.push('blockers');
            if ((applied.tasks > 0 || applied.blockers > 0) && applyMode !== 'blockers') sug.push('status');
            applied.reportsSuggested = Array.from(new Set(sug));
          } else {
            // Dedup
            applied.reportsSuggested = Array.from(new Set(applied.reportsSuggested.map((s) => String(s).trim()).filter(Boolean)));
          }

          // Persist
          writeJson(taskFile, taskLog);
          writeJson(blockerFile, blockerLog);

          return safeJson(res, 200, { ok: true, applied });
        }

        if (req.url === '/api/reports/open') {
          const rel = payload.relPath;
          if (!rel) return safeJson(res, 400, { error: 'Missing relPath' });
          const full = path.join(workspaceDir, rel);
          if (!exists(full)) return safeJson(res, 404, { error: 'Report not found' });

          // Best-effort: open the file with OS default app
          try {
            const platform = process.platform;
            if (platform === 'win32') {
              await run('cmd', ['/c', 'start', '', full], workspaceDir);
            } else if (platform === 'darwin') {
              await run('open', [full], workspaceDir);
            } else {
              await run('xdg-open', [full], workspaceDir);
            }
          } catch {
            // ignore; still return ok
          }

          return safeJson(res, 200, { ok: true, relPath: rel, fullPath: full });
        }

        if (req.url === '/api/init') {
          try {
            const { output } = await initWorkspace({ targetDir: workspaceDir, force: false, forceData: false, forceLogs: false });
            return safeJson(res, 200, { output: String(output || '').trim() });
          } catch (e) {
            const message = e && e.message ? e.message : String(e);
            return safeJson(res, 400, { error: message || 'init failed', output: '' });
          }
        }

        if (req.url === '/api/update') {
          try {
            const { output } = await initWorkspace({ targetDir: workspaceDir, force: false, forceData: false, forceLogs: false });
            return safeJson(res, 200, { output: String(output || '').trim() });
          } catch (e) {
            const message = e && e.message ? e.message : String(e);
            return safeJson(res, 400, { error: message || 'update failed', output: '' });
          }
        }

        const npmCmd = guessNpmCmd();

        if (req.url === '/api/health') {
          const r = await run(npmCmd, ['run', 'health'], workspaceDir);
          const output = (r.stdout + r.stderr).trim();
          return safeJson(res, r.code === 0 ? 200 : 400, r.code === 0 ? { output } : { error: output || 'health failed', output });
        }

        if (req.url === '/api/migrate') {
          const r = await run(npmCmd, ['run', 'migrate'], workspaceDir);
          const output = (r.stdout + r.stderr).trim();
          return safeJson(res, r.code === 0 ? 200 : 400, r.code === 0 ? { output } : { error: output || 'migrate failed', output });
        }



        if (req.url === '/api/obsidian/export') {
          const r = await run(npmCmd, ['run', 'export-obsidian'], workspaceDir);
          const out = (r.stdout + r.stderr).trim();
          return safeJson(res, r.code === 0 ? 200 : 400, r.code === 0 ? { ok: true, output: out } : { error: out || 'export failed', output: out });
        }

        if (req.url === '/api/index/rebuild') {
          const r = await run(npmCmd, ['run', 'build-index'], workspaceDir);
          const out = (r.stdout + r.stderr).trim();
          return safeJson(res, r.code === 0 ? 200 : 400, r.code === 0 ? { ok: true, output: out } : { error: out || 'index rebuild failed', output: out });
        }

        if (req.url === '/api/chat/ask') {
          const sessionId = String(payload.sessionId || '').trim();
          const query = String(payload.query || '').trim();
          if (!query) return safeJson(res, 400, { error: 'Missing query' });

          const copilotResult = await copilotSearch(workspaceDir, query, { limit: 8 });
          const indexMatches = searchIndex(workspaceDir, query, { limit: 12 });
          const baseMatches = indexMatches.length
            ? indexMatches
            : searchWorkspace(workspaceDir, query, { limit: 12 });

          if (copilotResult.ok) {
            const merged = mergeMatches(copilotResult.matches || [], baseMatches, 8);
            const answer = buildChatAnswer(
              query,
              merged.matches,
              copilotResult.summary,
              copilotResult.evidence,
              copilotResult.answer,
              merged.total
            );
            return safeJson(res, 200, { ok: true, sessionId, answer, matches: merged.matches });
          }

          const merged = mergeMatches(baseMatches, [], 8);
          const answer = buildChatAnswer(query, merged.matches, '', [], '', merged.total);
          return safeJson(res, 200, { ok: true, sessionId, answer, matches: merged.matches });
        }

        // Chat persistence (per session)
        if (req.url === '/api/chat/append') {
          const sessionId = String(payload.sessionId || '').trim();
          const role = String(payload.role || '').trim();
          const text = String(payload.text || '').trimEnd();
          const markdown = !!payload.markdown;
          const ts = typeof payload.ts === 'number' ? payload.ts : Date.now();
          if (!sessionId) return safeJson(res, 400, { error: 'Missing sessionId' });
          if (!role) return safeJson(res, 400, { error: 'Missing role' });
          if (!text) return safeJson(res, 400, { error: 'Missing text' });

          const d = isoDate();
          const base = path.join(workspaceDir, 'data', 'chat', d);
          ensureDir(base);
          const file = path.join(base, `${sessionId}.jsonl`);
          const item = { ts, role, markdown, text };
          fs.appendFileSync(file, JSON.stringify(item) + '\n', 'utf8');
          return safeJson(res, 200, { ok: true });
        }

        if (req.url === '/api/chat/load') {
          const sessionId = String(payload.sessionId || '').trim();
          const d = String(payload.date || '').trim() || isoDate();
          if (!sessionId) return safeJson(res, 400, { error: 'Missing sessionId' });
          const file = path.join(workspaceDir, 'data', 'chat', d, `${sessionId}.jsonl`);
          if (!exists(file)) return safeJson(res, 200, { ok: true, items: [] });

          const rawText = fs.readFileSync(file, 'utf8');
          const lines = rawText.split(/\r?\n/).filter(Boolean);
          const items = [];
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (!obj || typeof obj !== 'object') continue;
              items.push(obj);
            } catch {
              // ignore corrupt line
            }
          }
          return safeJson(res, 200, { ok: true, items });
        }

        if (req.url === '/api/chat/export-obsidian') {
          const sessionId = String(payload.sessionId || '').trim();
          const d = String(payload.date || '').trim() || isoDate();
          if (!sessionId) return safeJson(res, 400, { error: 'Missing sessionId' });
          const file = path.join(workspaceDir, 'data', 'chat', d, `${sessionId}.jsonl`);
          if (!exists(file)) return safeJson(res, 404, { error: 'Chat not found' });

          const rawText = fs.readFileSync(file, 'utf8');
          const lines = rawText.split(/\r?\n/).filter(Boolean);
          const items = [];
          for (const line of lines) {
            try {
              const obj = JSON.parse(line);
              if (!obj || typeof obj !== 'object') continue;
              items.push(obj);
            } catch {}
          }

          const outDir = path.join(workspaceDir, 'docs', 'chat');
          ensureDir(outDir);
          const outName = `conversa-${d}-${sessionId}.md`;
          const outPath = path.join(outDir, outName);

          const md = [];
          md.push('---');
          md.push(`type: chat`);
          md.push(`date: ${d}`);
          md.push(`session: ${sessionId}`);
          md.push('---');
          md.push('');
          md.push(`# Conversa - ${d}`);
          md.push('');

          for (const it of items) {
            const when = (() => {
              try {
                const dt = new Date(Number(it.ts || 0));
                const hh = String(dt.getHours()).padStart(2, '0');
                const mm = String(dt.getMinutes()).padStart(2, '0');
                return `${hh}:${mm}`;
              } catch { return ''; }
            })();
            const who = it.role === 'user' ? 'Você' : 'FREYA';
            md.push(`## [${when}] ${who}`);
            md.push('');
            md.push(String(it.text || '').trimEnd());
            md.push('');
          }

          fs.writeFileSync(outPath, md.join('\n') + '\n', 'utf8');
          return safeJson(res, 200, { ok: true, relPath: path.relative(workspaceDir, outPath).replace(/\\/g, '/') });
        }

        if (req.url === '/api/tasks/list') {
          const limit = Math.max(1, Math.min(50, Number(payload.limit || 10)));
          const cat = payload.category ? String(payload.category).trim() : null;
          const status = payload.status ? String(payload.status).trim() : null;

          const file = path.join(workspaceDir, 'data', 'tasks', 'task-log.json');
          const doc = readJsonOrNull(file) || { schemaVersion: 1, tasks: [] };
          const tasks = Array.isArray(doc.tasks) ? doc.tasks.slice() : [];

          const filtered = tasks
            .filter((t) => {
              if (!t || typeof t !== 'object') return false;
              if (cat && String(t.category || '').trim() !== cat) return false;
              if (status && String(t.status || '').trim() !== status) return false;
              return true;
            })
            .sort((a, b) => {
              const pa = String(a.priority || '').toLowerCase();
              const pb = String(b.priority || '').toLowerCase();
              const rank = (p) => (p === 'high' ? 0 : p === 'medium' ? 1 : p === 'low' ? 2 : 3);
              const ra = rank(pa), rb = rank(pb);
              if (ra !== rb) return ra - rb;
              return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
            })
            .slice(0, limit);

          return safeJson(res, 200, { ok: true, tasks: filtered });
        }

        if (req.url === '/api/tasks/complete') {
          const id = String(payload.id || '').trim();
          if (!id) return safeJson(res, 400, { error: 'Missing id' });

          const file = path.join(workspaceDir, 'data', 'tasks', 'task-log.json');
          const doc = readJsonOrNull(file) || { schemaVersion: 1, tasks: [] };
          const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];

          const now = isoNow();
          let updated = null;
          for (const t of tasks) {
            if (t && t.id === id) {
              t.status = 'COMPLETED';
              t.completedAt = now;
              updated = t;
              break;
            }
          }

          if (!updated) return safeJson(res, 404, { error: 'Task not found' });
          writeJson(file, doc);
          return safeJson(res, 200, { ok: true, task: updated });
        }


        if (req.url === '/api/tasks/update') {
          const id = String(payload.id || '').trim();
          if (!id) return safeJson(res, 400, { error: 'Missing id' });
          const patch = payload.patch && typeof payload.patch === 'object' ? payload.patch : {};

          const file = path.join(workspaceDir, 'data', 'tasks', 'task-log.json');
          const doc = readJsonOrNull(file) || { schemaVersion: 1, tasks: [] };
          const tasks = Array.isArray(doc.tasks) ? doc.tasks : [];

          let updated = null;
          for (const t of tasks) {
            if (t && t.id === id) {
              if (typeof patch.projectSlug === 'string') t.projectSlug = patch.projectSlug.trim() || undefined;
              if (typeof patch.category === 'string') t.category = patch.category.trim();
              updated = t;
              break;
            }
          }
          if (!updated) return safeJson(res, 404, { error: 'Task not found' });
          writeJson(file, doc);
          return safeJson(res, 200, { ok: true, task: updated });
        }

        if (req.url === '/api/blockers/list') {
          const limit = Math.max(1, Math.min(50, Number(payload.limit || 10)));
          const status = payload.status ? String(payload.status).trim() : 'OPEN';

          const file = path.join(workspaceDir, 'data', 'blockers', 'blocker-log.json');
          const doc = readJsonOrNull(file) || { schemaVersion: 1, blockers: [] };
          const blockers = Array.isArray(doc.blockers) ? doc.blockers.slice() : [];

          const sevRank = (s) => {
            const v = String(s || '').toUpperCase();
            if (v === 'CRITICAL') return 0;
            if (v === 'HIGH') return 1;
            if (v === 'MEDIUM') return 2;
            if (v === 'LOW') return 3;
            return 9;
          };

          const filtered = blockers
            .filter((b) => {
              if (!b || typeof b !== 'object') return false;
              if (status && String(b.status || '').trim() !== status) return false;
              return true;
            })
            .sort((a, b) => {
              const ra = sevRank(a.severity);
              const rb = sevRank(b.severity);
              if (ra !== rb) return ra - rb;
              return String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
            })
            .slice(0, limit);

          return safeJson(res, 200, { ok: true, blockers: filtered });
        }

        if (req.url === '/api/blockers/update') {
          const id = String(payload.id || '').trim();
          if (!id) return safeJson(res, 400, { error: 'Missing id' });
          const patch = payload.patch && typeof payload.patch === 'object' ? payload.patch : {};

          const file = path.join(workspaceDir, 'data', 'blockers', 'blocker-log.json');
          const doc = readJsonOrNull(file) || { schemaVersion: 1, blockers: [] };
          const blockers = Array.isArray(doc.blockers) ? doc.blockers : [];

          let updated = null;
          for (const b of blockers) {
            if (b && b.id === id) {
              if (typeof patch.projectSlug === 'string') b.projectSlug = patch.projectSlug.trim() || undefined;
              updated = b;
              break;
            }
          }
          if (!updated) return safeJson(res, 404, { error: 'Blocker not found' });
          writeJson(file, doc);
          return safeJson(res, 200, { ok: true, blocker: updated });
        }

        if (req.url === '/api/report') {
          const script = payload.script;
          if (!script) return safeJson(res, 400, { error: 'Missing script' });

          const r = await run(npmCmd, ['run', script], workspaceDir);
          const out = (r.stdout + r.stderr).trim();

          const reportsDir = path.join(workspaceDir, 'docs', 'reports');
          const prefixMap = {
            blockers: 'blockers-',
            'sm-weekly': 'sm-weekly-',
            status: 'executive-',
            daily: 'daily-'
          };
          const prefix = prefixMap[script] || null;
          const reportPath = prefix ? newestFile(reportsDir, prefix) : null;
          const reportText = reportPath && exists(reportPath) ? fs.readFileSync(reportPath, 'utf8') : null;

          // Prefer showing the actual report content when available.
          const output = reportText ? reportText : out;

          return safeJson(res, r.code === 0 ? 200 : 400, r.code === 0 ? { output, reportPath, reportText } : { error: output || 'report failed', output, reportPath, reportText });
        }

        if (req.url === '/api/publish') {
          const webhookUrl = payload.webhookUrl;
          const text = payload.text;
          const mode = payload.mode || 'chunks';
          const allowSecrets = !!payload.allowSecrets;
          if (!webhookUrl) return safeJson(res, 400, { error: 'Missing webhookUrl' });
          if (!text) return safeJson(res, 400, { error: 'Missing text' });

          const findings = scanSecrets(text);
          if (findings.length && !allowSecrets) {
            return safeJson(res, 400, {
              error: 'Potential secrets detected. Refusing to publish.',
              details: JSON.stringify(findings, null, 2),
              hint: 'Remova/mascare tokens ou confirme a publicação mesmo assim.'
            });
          }

          const safeText = findings.length ? redactSecrets(text) : text;

          try {
            const result = await publishRobust(webhookUrl, safeText, { mode });
            return safeJson(res, 200, { ...result, redacted: findings.length > 0, findings });
          } catch (e) {
            return safeJson(res, 400, { error: e.message || String(e) });
          }
        }

        return safeJson(res, 404, { error: 'Not found' });
      }

      safeJson(res, 404, { error: 'Not found' });
    } catch (e) {
      safeJson(res, 500, { error: e.message || String(e) });
    }
  });

  await new Promise((resolve) => server.listen(port, host, resolve));

  const url = `http://${host}:${port}/`;

  // Optional dev seed
  // Safety rules:
  // - only seed when workspace is empty OR already initialized as a Freya workspace
  // - never overwrite non-dev user content
  if (dev) {
    const target = dir ? path.resolve(process.cwd(), dir) : path.join(process.cwd(), 'freya');
    try {
      const targetOk = looksLikeFreyaWorkspace(target);
      const empty = looksEmptyWorkspace(target);
      if (!targetOk && !empty) {
        fs.writeSync(process.stdout.fd, `Dev seed: skipped (workspace not empty and not initialized) -> ${target}\n`);
      } else {
        seedDevWorkspace(target);
        fs.writeSync(process.stdout.fd, `Dev seed: created demo files in ${target}\n`);
      }
    } catch (e) {
      fs.writeSync(process.stdout.fd, `Dev seed failed: ${e.message || String(e)}\n`);
    }
  }

  fs.writeSync(process.stdout.fd, `FREYA web running at ${url}\n`);
  if (open) openBrowser(url);
}

module.exports = { cmdWeb };
