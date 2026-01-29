'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function guessNpmCmd() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function guessNpxCmd() {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
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
    let child;
    try {
      child = spawn(cmd, args, { cwd, shell: false, env: process.env });
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

    // Prevent unhandled error event (e.g., ENOENT on Windows when cmd not found)
    child.on('error', (e) => {
      stderr += `\n${e.message || String(e)}`;
      resolve({ code: 1, stdout, stderr });
    });

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

function html() {
  // Aesthetic: “Noir control room” — dark glass, crisp typography, intentional hierarchy.
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FREYA Web</title>
  <style>
    :root {
      --bg: #070a10;
      --bg2: #0a1020;
      --panel: rgba(255,255,255,.04);
      --panel2: rgba(255,255,255,.06);
      --line: rgba(180,210,255,.16);
      --text: #e9f0ff;
      --muted: rgba(233,240,255,.72);
      --faint: rgba(233,240,255,.52);
      --accent: #5eead4;
      --accent2: #60a5fa;
      --danger: #fb7185;
      --ok: #34d399;
      --warn: #fbbf24;
      --shadow: 0 30px 70px rgba(0,0,0,.55);
      --radius: 16px;
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      color: var(--text);
      background:
        radial-gradient(900px 560px at 18% 12%, rgba(94,234,212,.14), transparent 60%),
        radial-gradient(820px 540px at 72% 6%, rgba(96,165,250,.14), transparent 60%),
        radial-gradient(900px 700px at 70% 78%, rgba(251,113,133,.08), transparent 60%),
        linear-gradient(180deg, var(--bg), var(--bg2));
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Helvetica Neue", Arial;
      overflow-x: hidden;
    }

    /* subtle noise */
    body:before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        linear-gradient(transparent 0, transparent 2px, rgba(255,255,255,.02) 3px),
        radial-gradient(circle at 10% 10%, rgba(255,255,255,.06), transparent 35%),
        radial-gradient(circle at 90% 30%, rgba(255,255,255,.04), transparent 35%);
      background-size: 100% 6px, 900px 900px, 900px 900px;
      mix-blend-mode: overlay;
      opacity: .12;
    }

    header {
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(14px);
      background: rgba(7,10,16,.56);
      border-bottom: 1px solid var(--line);
    }

    .top {
      max-width: 1140px;
      margin: 0 auto;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .brand {
      display: flex;
      align-items: baseline;
      gap: 12px;
      letter-spacing: .16em;
      text-transform: uppercase;
      font-weight: 700;
      font-size: 12px;
      color: var(--muted);
    }

    .badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.03);
      color: var(--faint);
    }

    .wrap {
      max-width: 1140px;
      margin: 0 auto;
      padding: 18px;
    }

    .hero {
      display: grid;
      grid-template-columns: 1.2fr .8fr;
      gap: 16px;
      align-items: start;
      margin-bottom: 16px;
    }

    @media (max-width: 980px) {
      .hero { grid-template-columns: 1fr; }
    }

    .card {
      border: 1px solid var(--line);
      background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 14px;
      position: relative;
      overflow: hidden;
    }

    .card:before {
      content: "";
      position: absolute;
      inset: -2px;
      background:
        radial-gradient(900px 220px at 25% 0%, rgba(94,234,212,.12), transparent 60%),
        radial-gradient(900px 220px at 90% 30%, rgba(96,165,250,.10), transparent 60%);
      opacity: .55;
      pointer-events: none;
    }

    .card > * { position: relative; }

    h2 {
      margin: 0 0 8px;
      font-size: 14px;
      letter-spacing: .08em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .sub {
      margin: 0 0 10px;
      font-size: 12px;
      color: var(--faint);
      line-height: 1.35;
    }

    label {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 6px;
    }

    .field {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }

    input {
      width: 100%;
      padding: 12px 12px;
      border-radius: 12px;
      border: 1px solid rgba(180,210,255,.22);
      background: rgba(7,10,16,.55);
      color: var(--text);
      outline: none;
    }

    input::placeholder { color: rgba(233,240,255,.38); }

    .btns {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 10px;
    }

    button {
      border: 1px solid rgba(180,210,255,.22);
      border-radius: 12px;
      background: rgba(255,255,255,.04);
      color: var(--text);
      padding: 10px 12px;
      cursor: pointer;
      transition: transform .08s ease, background .16s ease, border-color .16s ease;
      font-weight: 600;
      letter-spacing: .01em;
    }

    button:hover { transform: translateY(-1px); background: rgba(255,255,255,.06); border-color: rgba(180,210,255,.32); }
    button:active { transform: translateY(0); }

    .primary {
      background: linear-gradient(135deg, rgba(94,234,212,.18), rgba(96,165,250,.16));
      border-color: rgba(94,234,212,.28);
    }

    .ghost { background: rgba(255,255,255,.02); }

    .danger { border-color: rgba(251,113,133,.45); background: rgba(251,113,133,.12); }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border-radius: 999px;
      border: 1px solid rgba(180,210,255,.18);
      background: rgba(0,0,0,.18);
      font-size: 12px;
      color: var(--faint);
    }

    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warn); box-shadow: 0 0 0 5px rgba(251,191,36,.14); }
    .dot.ok { background: var(--ok); box-shadow: 0 0 0 5px rgba(52,211,153,.12); }
    .dot.err { background: var(--danger); box-shadow: 0 0 0 5px rgba(251,113,133,.12); }

    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    @media (max-width: 980px) { .two { grid-template-columns: 1fr; } }

    .hr { height: 1px; background: rgba(180,210,255,.14); margin: 12px 0; }

    .log {
      border-radius: 14px;
      border: 1px solid rgba(180,210,255,.18);
      background: rgba(7,10,16,.55);
      padding: 12px;
      min-height: 220px;
      max-height: 420px;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
      line-height: 1.35;
      white-space: pre-wrap;
      color: rgba(233,240,255,.84);
    }

    .hint {
      font-size: 12px;
      color: var(--faint);
      margin-top: 6px;
      line-height: 1.35;
    }

    .footer {
      margin-top: 12px;
      font-size: 12px;
      color: rgba(233,240,255,.45);
    }

    a { color: var(--accent2); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <header>
    <div class="top">
      <div class="brand">FREYA <span style="opacity:.55">•</span> web console</div>
      <div class="badge" id="status">ready</div>
    </div>
  </header>

  <div class="wrap">
    <div class="hero">
      <div class="card">
        <h2>1) Workspace</h2>
        <p class="sub">Escolha onde está (ou onde será criada) sua workspace da FREYA. Se você já tem uma workspace antiga, use <b>Update</b> — seus <b>data/logs</b> ficam preservados.</p>

        <label>Workspace dir</label>
        <div class="field">
          <input id="dir" placeholder="./freya" />
          <button class="ghost" onclick="pickDir()">Browse…</button>
        </div>
        <div class="hint">Dica: a workspace contém <code>data/</code>, <code>logs/</code> e <code>scripts/</code>.</div>

        <div class="btns">
          <button class="primary" onclick="doInit()">Init</button>
          <button onclick="doUpdate()">Update</button>
          <button onclick="doHealth()">Health</button>
          <button onclick="doMigrate()">Migrate</button>
        </div>

        <div class="footer">Atalho: <code>freya web --dir ./freya</code> (porta padrão 3872).</div>
      </div>

      <div class="card">
        <h2>2) Publish</h2>
        <p class="sub">Configure webhooks (opcional) para publicar relatórios com 1 clique. Ideal para mandar status no Teams/Discord.</p>

        <label>Discord webhook URL</label>
        <input id="discord" placeholder="https://discord.com/api/webhooks/..." />

        <div style="height:10px"></div>
        <label>Teams webhook URL</label>
        <input id="teams" placeholder="https://..." />

        <div class="hr"></div>
        <div class="btns">
          <button onclick="publish('discord')">Publish last → Discord</button>
          <button onclick="publish('teams')">Publish last → Teams</button>
        </div>
        <div class="hint">O publish usa o texto do último relatório gerado. Para MVP, limitamos em ~1800 caracteres (evita limites de webhook). Depois a gente melhora para anexos/chunks.</div>
      </div>
    </div>

    <div class="two">
      <div class="card">
        <h2>3) Generate</h2>
        <p class="sub">Gere relatórios e use o preview/log abaixo para validar. Depois, publique ou copie.</p>

        <div class="btns">
          <button class="primary" onclick="runReport('status')">Executive</button>
          <button class="primary" onclick="runReport('sm-weekly')">SM Weekly</button>
          <button class="primary" onclick="runReport('blockers')">Blockers</button>
          <button class="ghost" onclick="runReport('daily')">Daily</button>
        </div>

        <div class="hint" id="last"></div>
      </div>

      <div class="card">
        <h2>Output</h2>
        <div class="pill"><span class="dot" id="dot"></span><span id="pill">idle</span></div>
        <div style="height:10px"></div>
        <div class="log" id="out"></div>
        <div class="footer">Dica: se o report foi salvo em arquivo, ele aparece em “Last report”.</div>
      </div>
    </div>
  </div>

<script>
  const $ = (id) => document.getElementById(id);
  const state = { lastReportPath: null, lastText: '' };

  function setPill(kind, text) {
    const dot = $('dot');
    dot.classList.remove('ok','err');
    if (kind === 'ok') dot.classList.add('ok');
    if (kind === 'err') dot.classList.add('err');
    $('pill').textContent = text;
  }

  function setOut(text) {
    state.lastText = text || '';
    $('out').textContent = text || '';
  }

  function setLast(p) {
    state.lastReportPath = p;
    $('last').textContent = p ? ('Last report: ' + p) : '';
  }

  function saveLocal() {
    localStorage.setItem('freya.dir', $('dir').value);
    localStorage.setItem('freya.discord', $('discord').value);
    localStorage.setItem('freya.teams', $('teams').value);
  }

  function loadLocal() {
    $('dir').value = localStorage.getItem('freya.dir') || './freya';
    $('discord').value = localStorage.getItem('freya.discord') || '';
    $('teams').value = localStorage.getItem('freya.teams') || '';
  }

  async function api(p, body) {
    const res = await fetch(p, {
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

  async function pickDir() {
    try {
      setPill('run','opening picker…');
      const r = await api('/api/pick-dir', {});
      if (r && r.dir) $('dir').value = r.dir;
      saveLocal();
      setPill('ok','ready');
    } catch (e) {
      setPill('err','picker unavailable');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doInit() {
    try {
      saveLocal();
      setPill('run','init…');
      setOut('');
      const r = await api('/api/init', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      setPill('ok','init ok');
    } catch (e) {
      setPill('err','init failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doUpdate() {
    try {
      saveLocal();
      setPill('run','update…');
      setOut('');
      const r = await api('/api/update', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      setPill('ok','update ok');
    } catch (e) {
      setPill('err','update failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doHealth() {
    try {
      saveLocal();
      setPill('run','health…');
      setOut('');
      const r = await api('/api/health', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      setPill('ok','health ok');
    } catch (e) {
      setPill('err','health failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doMigrate() {
    try {
      saveLocal();
      setPill('run','migrate…');
      setOut('');
      const r = await api('/api/migrate', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      setPill('ok','migrate ok');
    } catch (e) {
      setPill('err','migrate failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function runReport(name) {
    try {
      saveLocal();
      setPill('run', name + '…');
      setOut('');
      const r = await api('/api/report', { dir: dirOrDefault(), script: name });
      setOut(r.output);
      setLast(r.reportPath || null);
      if (r.reportText) state.lastText = r.reportText;
      setPill('ok', name + ' ok');
    } catch (e) {
      setPill('err', name + ' failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function publish(target) {
    try {
      saveLocal();
      if (!state.lastText) throw new Error('Generate a report first.');
      const webhookUrl = target === 'discord' ? $('discord').value.trim() : $('teams').value.trim();
      if (!webhookUrl) throw new Error('Configure the webhook URL first.');
      setPill('run','publishing…');
      await api('/api/publish', { webhookUrl, text: state.lastText });
      setPill('ok','published');
    } catch (e) {
      setPill('err','publish failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  loadLocal();
</script>
</body>
</html>`;
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

function seedDevWorkspace(workspaceDir) {
  // Only create if missing; never overwrite user content.
  ensureDir(path.join(workspaceDir, 'data', 'tasks'));
  ensureDir(path.join(workspaceDir, 'data', 'career'));
  ensureDir(path.join(workspaceDir, 'data', 'blockers'));
  ensureDir(path.join(workspaceDir, 'data', 'Clients', 'acme', 'rocket'));
  ensureDir(path.join(workspaceDir, 'logs', 'daily'));

  const taskLog = path.join(workspaceDir, 'data', 'tasks', 'task-log.json');
  if (!exists(taskLog)) {
    fs.writeFileSync(taskLog, JSON.stringify({
      schemaVersion: 1,
      tasks: [
        { id: 't-demo-1', description: 'Preparar update executivo', category: 'DO_NOW', status: 'PENDING', createdAt: isoNow(), priority: 'high' },
        { id: 't-demo-2', description: 'Revisar PR de integração Teams', category: 'SCHEDULE', status: 'PENDING', createdAt: isoNow(), priority: 'medium' },
        { id: 't-demo-3', description: 'Rodar retro e registrar aprendizados', category: 'DO_NOW', status: 'COMPLETED', createdAt: isoNow(), completedAt: isoNow(), priority: 'low' }
      ]
    }, null, 2) + '\n', 'utf8');
  }

  const careerLog = path.join(workspaceDir, 'data', 'career', 'career-log.json');
  if (!exists(careerLog)) {
    fs.writeFileSync(careerLog, JSON.stringify({
      schemaVersion: 1,
      entries: [
        { id: 'c-demo-1', date: isoDate(), type: 'Achievement', description: 'Publicou o CLI @cccarv82/freya com init/web', tags: ['shipping', 'tooling'], source: 'dev-seed' },
        { id: 'c-demo-2', date: isoDate(), type: 'Feedback', description: 'Feedback: UX do painel web está “muito promissor”', tags: ['product'], source: 'dev-seed' }
      ]
    }, null, 2) + '\n', 'utf8');
  }

  const blockerLog = path.join(workspaceDir, 'data', 'blockers', 'blocker-log.json');
  if (!exists(blockerLog)) {
    fs.writeFileSync(blockerLog, JSON.stringify({
      schemaVersion: 1,
      blockers: [
        { id: 'b-demo-1', title: 'Webhook do Teams falhando em ambientes com 2FA', description: 'Ajustar token / payload', createdAt: isoNow(), status: 'OPEN', severity: 'HIGH', nextAction: 'Validar payload e limites' },
        { id: 'b-demo-2', title: 'Definir template de status report por cliente', description: 'Padronizar headings', createdAt: isoNow(), status: 'MITIGATING', severity: 'MEDIUM' }
      ]
    }, null, 2) + '\n', 'utf8');
  }

  const projectStatus = path.join(workspaceDir, 'data', 'Clients', 'acme', 'rocket', 'status.json');
  if (!exists(projectStatus)) {
    fs.writeFileSync(projectStatus, JSON.stringify({
      schemaVersion: 1,
      client: 'Acme',
      project: 'Rocket',
      currentStatus: 'Green — progressing as planned',
      lastUpdated: isoNow(),
      active: true,
      history: [
        { date: isoNow(), type: 'Status', content: 'Launched stage 1', source: 'dev-seed' },
        { date: isoNow(), type: 'Risk', content: 'Potential delay on vendor dependency', source: 'dev-seed' }
      ]
    }, null, 2) + '\n', 'utf8');
  }

  const dailyLog = path.join(workspaceDir, 'logs', 'daily', `${isoDate()}.md`);
  if (!exists(dailyLog)) {
    fs.writeFileSync(dailyLog, `# Daily Log ${isoDate()}\n\n## [09:15] Raw Input\nReunião com a Acme. Tudo verde, mas preciso alinhar com fornecedor.\n\n## [16:40] Raw Input\nTerminei o relatório SM e publiquei no Discord.\n`, 'utf8');
  }

  return {
    seeded: true,
    paths: { taskLog, careerLog, blockerLog, projectStatus, dailyLog }
  };
}

async function cmdWeb({ port, dir, open, dev }) {
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

        if (req.url === '/api/pick-dir') {
          const picked = await pickDirectoryNative();
          return safeJson(res, 200, { dir: picked });
        }

        if (req.url === '/api/init') {
          const pkg = '@cccarv82/freya';
          const r = await run(guessNpxCmd(), [pkg, 'init', workspaceDir], process.cwd());
          return safeJson(res, r.code === 0 ? 200 : 400, { output: (r.stdout + r.stderr).trim() });
        }

        if (req.url === '/api/update') {
          const pkg = '@cccarv82/freya';
          fs.mkdirSync(workspaceDir, { recursive: true });
          const r = await run(guessNpxCmd(), [pkg, 'init', '--here'], workspaceDir);
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
          const reportText = reportPath && exists(reportPath) ? fs.readFileSync(reportPath, 'utf8') : null;

          // Prefer showing the actual report content when available.
          const output = reportText ? reportText : out;

          return safeJson(res, r.code === 0 ? 200 : 400, { output, reportPath, reportText });
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

          const proto = u.protocol === 'https:' ? require('https') : require('http');
          const req2 = proto.request(options, (r2) => {
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

  // Optional dev seed (safe: only creates files if missing)
  if (dev) {
    const target = dir ? path.resolve(process.cwd(), dir) : path.join(process.cwd(), 'freya');
    try {
      seedDevWorkspace(target);
      process.stdout.write(`Dev seed: created demo files in ${target}\n`);
    } catch (e) {
      process.stdout.write(`Dev seed failed: ${e.message || String(e)}\n`);
    }
  }

  process.stdout.write(`FREYA web running at ${url}\n`);
  if (open) openBrowser(url);
}

module.exports = { cmdWeb };
