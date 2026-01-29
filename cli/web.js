'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function guessNpmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function guessOpenCmd() {
  // Minimal cross-platform opener without extra deps
  if (process.platform === 'win32') return { cmd: 'cmd', args: ['/c', 'start', ''] };
  if (process.platform === 'darwin') return { cmd: 'open', args: [] };
  return { cmd: 'xdg-open', args: [] };
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function newestFile(dir, prefix) {
  if (!exists(dir)) return null;
  const files = fs.readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.md'))
    .map((f) => ({ f, p: path.join(dir, f) }))
    .filter((x) => {
      try { return fs.statSync(x.p).isFile(); } catch { return false; }
    })
    .sort((a, b) => {
      try { return fs.statSync(b.p).mtimeMs - fs.statSync(a.p).mtimeMs; } catch { return 0; }
    });
  return files[0]?.p || null;
}

function safeJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
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
    const child = spawn(cmd, args, { cwd, shell: false, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

function openBrowser(url) {
  const { cmd, args } = guessOpenCmd();
  try {
    spawn(cmd, [...args, url], { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // ignore
  }
}

function html() {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FREYA</title>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Helvetica, Arial; margin: 0; background: #0b0f14; color: #e6edf3; }
    header { padding: 16px 18px; border-bottom: 1px solid #1f2a37; display:flex; gap:12px; align-items:center; }
    header h1 { font-size: 14px; margin:0; letter-spacing: .08em; text-transform: uppercase; color:#9fb2c7; }
    .wrap { max-width: 980px; margin: 0 auto; padding: 18px; }
    .card { border: 1px solid #1f2a37; border-radius: 12px; background: #0f1620; padding: 14px; }
    .grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
    @media (min-width: 920px) { .grid { grid-template-columns: 1.2fr .8fr; } }
    label { font-size: 12px; color:#9fb2c7; display:block; margin-bottom: 6px; }
    input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #223041; background:#0b1220; color:#e6edf3; }
    .btns { display:flex; flex-wrap:wrap; gap: 10px; margin-top: 10px; }
    button { padding: 10px 12px; border-radius: 10px; border: 1px solid #223041; background:#1f6feb; color:white; cursor:pointer; }
    button.secondary { background: transparent; color:#e6edf3; }
    button.danger { background: #d73a49; }
    .row { display:grid; grid-template-columns: 1fr; gap: 10px; }
    .small { font-size: 12px; color:#9fb2c7; }
    pre { white-space: pre-wrap; background:#0b1220; border: 1px solid #223041; border-radius: 12px; padding: 12px; overflow:auto; }
    a { color:#58a6ff; }
  </style>
</head>
<body>
  <header>
    <h1>FREYA • Local-first Status Assistant</h1>
    <span class="small" id="status"></span>
  </header>
  <div class="wrap">
    <div class="grid">
      <div class="card">
        <div class="row">
          <div>
            <label>Workspace dir</label>
            <input id="dir" placeholder="/path/to/freya (or ./freya)" />
            <div class="small">Dica: a workspace é a pasta que contém <code>data/</code>, <code>logs/</code>, <code>scripts/</code>.</div>
          </div>
          <div class="btns">
            <button onclick="doInit()">Init (preserva data/logs)</button>
            <button class="secondary" onclick="doUpdate()">Update (init --here)</button>
            <button class="secondary" onclick="doHealth()">Health</button>
            <button class="secondary" onclick="doMigrate()">Migrate</button>
          </div>
        </div>

        <hr style="border:0;border-top:1px solid #1f2a37;margin:14px 0" />

        <div class="btns">
          <button onclick="runReport('status')">Generate Executive Report</button>
          <button onclick="runReport('sm-weekly')">Generate SM Weekly</button>
          <button onclick="runReport('blockers')">Generate Blockers</button>
          <button onclick="runReport('daily')">Generate Daily</button>
        </div>

        <div style="margin-top:12px">
          <label>Output</label>
          <pre id="out"></pre>
          <div class="small" id="last"></div>
        </div>
      </div>

      <div class="card">
        <div class="row">
          <div>
            <label>Discord Webhook URL (optional)</label>
            <input id="discord" placeholder="https://discord.com/api/webhooks/..." />
          </div>
          <div>
            <label>Teams Webhook URL (optional)</label>
            <input id="teams" placeholder="https://..." />
          </div>
          <div class="btns">
            <button class="secondary" onclick="publish('discord')">Publish last → Discord</button>
            <button class="secondary" onclick="publish('teams')">Publish last → Teams</button>
          </div>
          <div class="small">
            Publica o último relatório gerado (cache local). Limite: ~1800 chars (pra evitar limites de webhook).
          </div>
        </div>
      </div>

    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);
  const state = {
    lastReportPath: null,
    lastText: ''
  };

  function setOut(text) {
    state.lastText = text;
    $('out').textContent = text || '';
  }

  function setLast(path) {
    state.lastReportPath = path;
    $('last').textContent = path ? ('Last report: ' + path) : '';
  }

  function saveLocal() {
    localStorage.setItem('freya.dir', $('dir').value);
    localStorage.setItem('freya.discord', $('discord').value);
    localStorage.setItem('freya.teams', $('teams').value);
  }

  function loadLocal() {
    $('dir').value = localStorage.getItem('freya.dir') || '';
    $('discord').value = localStorage.getItem('freya.discord') || '';
    $('teams').value = localStorage.getItem('freya.teams') || '';
  }

  async function api(path, body) {
    const res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Request failed');
    return json;
  }

  function dirOrDefault() {
    const d = $('dir').value.trim();
    return d || './freya';
  }

  async function doInit() {
    saveLocal();
    setOut('Running init...');
    const r = await api('/api/init', { dir: dirOrDefault() });
    setOut(r.output);
    setLast(null);
  }

  async function doUpdate() {
    saveLocal();
    setOut('Running update...');
    const r = await api('/api/update', { dir: dirOrDefault() });
    setOut(r.output);
    setLast(null);
  }

  async function doHealth() {
    saveLocal();
    setOut('Running health...');
    const r = await api('/api/health', { dir: dirOrDefault() });
    setOut(r.output);
    setLast(null);
  }

  async function doMigrate() {
    saveLocal();
    setOut('Running migrate...');
    const r = await api('/api/migrate', { dir: dirOrDefault() });
    setOut(r.output);
    setLast(null);
  }

  async function runReport(name) {
    saveLocal();
    setOut('Running ' + name + '...');
    const r = await api('/api/report', { dir: dirOrDefault(), script: name });
    setOut(r.output);
    setLast(r.reportPath || null);
  }

  async function publish(target) {
    saveLocal();
    if (!state.lastText) throw new Error('No cached output. Generate a report first.');
    const webhookUrl = target === 'discord' ? $('discord').value.trim() : $('teams').value.trim();
    setOut('Publishing to ' + target + '...');
    const r = await api('/api/publish', { webhookUrl, text: state.lastText });
    setOut('Published.');
  }

  loadLocal();
  $('status').textContent = 'ready';
</script>
</body>
</html>`;
}

async function cmdWeb({ port, dir, open }) {
  const host = '127.0.0.1';

  const server = http.createServer(async (req, res) => {
    try {
      if (!req.url) return safeJson(res, 404, { error: 'Not found' });

      if (req.method === 'GET' && req.url === '/') {
        const body = html();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(body);
        return;
      }

      if (req.url.startsWith('/api/')) {
        const raw = await readBody(req);
        const payload = raw ? JSON.parse(raw) : {};

        const workspaceDir = path.resolve(process.cwd(), payload.dir || dir || './freya');

        if (req.url === '/api/init') {
          const pkg = '@cccarv82/freya';
          const r = await run('npx', [pkg, 'init', workspaceDir], process.cwd());
          return safeJson(res, r.code === 0 ? 200 : 400, { output: (r.stdout + r.stderr).trim() });
        }

        if (req.url === '/api/update') {
          const pkg = '@cccarv82/freya';
          fs.mkdirSync(workspaceDir, { recursive: true });
          const r = await run('npx', [pkg, 'init', '--here'], workspaceDir);
          return safeJson(res, r.code === 0 ? 200 : 400, { output: (r.stdout + r.stderr).trim() });
        }

        const npmCmd = guessNpmCmd();

        if (req.url === '/api/health') {
          const r = await run(npmCmd, ['run', 'health'], workspaceDir);
          return safeJson(res, r.code === 0 ? 200 : 400, { output: (r.stdout + r.stderr).trim() });
        }

        if (req.url === '/api/migrate') {
          const r = await run(npmCmd, ['run', 'migrate'], workspaceDir);
          return safeJson(res, r.code === 0 ? 200 : 400, { output: (r.stdout + r.stderr).trim() });
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
            daily: null
          };
          const prefix = prefixMap[script] || null;
          const reportPath = prefix ? newestFile(reportsDir, prefix) : null;

          return safeJson(res, r.code === 0 ? 200 : 400, { output: out, reportPath });
        }

        if (req.url === '/api/publish') {
          const webhookUrl = payload.webhookUrl;
          const text = payload.text;
          if (!webhookUrl) return safeJson(res, 400, { error: 'Missing webhookUrl' });
          if (!text) return safeJson(res, 400, { error: 'Missing text' });

          // Minimal webhook post: Discord expects {content}, Teams expects {text}
          const u = new URL(webhookUrl);
          const isDiscord = u.hostname.includes('discord.com') || u.hostname.includes('discordapp.com');
          const body = JSON.stringify(isDiscord ? { content: text.slice(0, 1800) } : { text: text.slice(0, 1800) });

          const options = {
            method: 'POST',
            hostname: u.hostname,
            path: u.pathname + u.search,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(body)
            }
          };

          const req2 = require(u.protocol === 'https:' ? 'https' : 'http').request(options, (r2) => {
            const chunks = [];
            r2.on('data', (c) => chunks.push(c));
            r2.on('end', () => {
              if (r2.statusCode >= 200 && r2.statusCode < 300) return safeJson(res, 200, { ok: true });
              return safeJson(res, 400, { error: `Webhook error ${r2.statusCode}: ${Buffer.concat(chunks).toString('utf8')}` });
            });
          });
          req2.on('error', (e) => safeJson(res, 400, { error: e.message }));
          req2.write(body);
          req2.end();
          return;
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
  process.stdout.write(`FREYA web running at ${url}\n`);
  if (open) openBrowser(url);
}

module.exports = { cmdWeb };
