'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function guessNpmCmd() {
  // We'll execute via cmd.exe on Windows for reliability.
  return process.platform === 'win32' ? 'npm' : 'npm';
}

function guessNpxCmd() {
  // We'll execute via cmd.exe on Windows for reliability.
  return process.platform === 'win32' ? 'npx' : 'npx';
}

function guessNpxYesFlag() {
  // npx supports --yes/-y on modern npm; use -y for broad compatibility
  return '-y';
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

function safeJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
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
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FREYA Web</title>
  <style>
    /*
      Design goals:
      - Light theme by default (inspired by your reference screenshots)
      - Dark mode toggle
      - App-like layout: sidebar + main surface
      - Clear onboarding and affordances
    */

    :root {
      --radius: 14px;
      --shadow: 0 18px 55px rgba(16, 24, 40, .10);
      --shadow2: 0 10px 20px rgba(16, 24, 40, .08);
      --ring: 0 0 0 4px rgba(59, 130, 246, .18);

      /* Light */
      --bg: #f6f7fb;
      --paper: #ffffff;
      --paper2: #fbfbfd;
      --line: rgba(16, 24, 40, .10);
      --line2: rgba(16, 24, 40, .14);
      --text: #0f172a;
      --muted: rgba(15, 23, 42, .68);
      --faint: rgba(15, 23, 42, .50);

      --primary: #2563eb;
      --primary2: #0ea5e9;
      --accent: #f97316;
      --ok: #16a34a;
      --warn: #f59e0b;
      --danger: #e11d48;

      --chip: rgba(37, 99, 235, .08);
      --chip2: rgba(249, 115, 22, .10);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial;
    }

    [data-theme="dark"] {
      --bg: #0b1020;
      --paper: rgba(255,255,255,.06);
      --paper2: rgba(255,255,255,.04);
      --line: rgba(255,255,255,.12);
      --line2: rgba(255,255,255,.18);
      --text: #e9f0ff;
      --muted: rgba(233,240,255,.72);
      --faint: rgba(233,240,255,.54);

      --primary: #60a5fa;
      --primary2: #22c55e;
      --accent: #fb923c;
      --chip: rgba(96, 165, 250, .14);
      --chip2: rgba(251, 146, 60, .14);

      --shadow: 0 30px 70px rgba(0,0,0,.55);
      --shadow2: 0 18px 40px rgba(0,0,0,.35);
      --ring: 0 0 0 4px rgba(96, 165, 250, .22);
    }

    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      background:
        radial-gradient(1200px 800px at 20% -10%, rgba(37,99,235,.12), transparent 55%),
        radial-gradient(900px 600px at 92% 10%, rgba(249,115,22,.12), transparent 55%),
        radial-gradient(1100px 700px at 70% 105%, rgba(14,165,233,.10), transparent 55%),
        var(--bg);
      color: var(--text);
      font-family: var(--sans);
    }

    /* subtle grain */
    body:before {
      content: "";
      position: fixed;
      inset: 0;
      pointer-events: none;
      background-image:
        radial-gradient(circle at 15% 20%, rgba(255,255,255,.38), transparent 32%),
        radial-gradient(circle at 80% 10%, rgba(255,255,255,.26), transparent 38%),
        linear-gradient(transparent 0, transparent 3px, rgba(0,0,0,.02) 4px);
      background-size: 900px 900px, 900px 900px, 100% 7px;
      opacity: .08;
      mix-blend-mode: overlay;
    }

    .app {
      max-width: 1260px;
      margin: 18px auto;
      padding: 0 18px;
    }

    .frame {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 14px;
      min-height: calc(100vh - 36px);
    }

    @media (max-width: 980px) {
      .frame { grid-template-columns: 1fr; }
    }

    .sidebar {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow2);
      padding: 14px;
      position: sticky;
      top: 18px;
      height: fit-content;
    }

    .main {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, var(--paper2), var(--paper));
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      letter-spacing: .08em;
      text-transform: uppercase;
      font-size: 12px;
      color: var(--muted);
    }

    .spark {
      width: 10px;
      height: 10px;
      border-radius: 4px;
      background: linear-gradient(135deg, var(--accent), var(--primary));
      box-shadow: 0 0 0 6px rgba(249,115,22,.12);
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .chip {
      font-family: var(--mono);
      font-size: 12px;
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.55);
      color: var(--faint);
    }

    [data-theme="dark"] .chip { background: rgba(0,0,0,.20); }

    .toggle {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--paper2);
      padding: 7px 10px;
      cursor: pointer;
      color: var(--muted);
      font-weight: 700;
      font-size: 12px;
    }

    .section {
      padding: 16px;
    }

    h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -.02em;
    }

    .subtitle {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.4;
      max-width: 860px;
    }

    .cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-top: 14px;
    }

    @media (max-width: 1100px) { .cards { grid-template-columns: repeat(2, 1fr);} }
    @media (max-width: 620px) { .cards { grid-template-columns: 1fr;} }

    .card {
      border: 1px solid var(--line);
      background: var(--paper2);
      border-radius: 14px;
      padding: 12px;
      display: grid;
      gap: 6px;
      cursor: pointer;
      transition: transform .10s ease, border-color .16s ease, box-shadow .16s ease;
      box-shadow: 0 1px 0 rgba(16,24,40,.04);
    }

    .card:hover {
      transform: translateY(-1px);
      border-color: var(--line2);
      box-shadow: 0 10px 22px rgba(16,24,40,.10);
    }

    .icon {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      background: var(--chip);
      border: 1px solid var(--line);
      color: var(--primary);
      font-weight: 900;
    }

    .icon.orange { background: var(--chip2); color: var(--accent); }

    .title {
      font-weight: 800;
      font-size: 13px;
    }

    .desc {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
    }

    .grid2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 14px;
    }

    @media (max-width: 980px) { .grid2 { grid-template-columns: 1fr; } }

    .panel {
      border: 1px solid var(--line);
      background: var(--paper);
      border-radius: 14px;
      overflow: hidden;
    }

    .panelHead {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 12px;
      border-bottom: 1px solid var(--line);
      background: linear-gradient(180deg, var(--paper2), var(--paper));
    }

    .panelHead b { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

    .panelBody { padding: 12px; }

    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 6px; }

    input {
      width: 100%;
      padding: 11px 12px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.72);
      color: var(--text);
      outline: none;
    }

    [data-theme="dark"] input { background: rgba(0,0,0,.16); }

    input:focus { box-shadow: var(--ring); border-color: rgba(37,99,235,.35); }

    .row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 10px;
      align-items: center;
    }

    .btn {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--paper2);
      color: var(--text);
      padding: 10px 12px;
      cursor: pointer;
      font-weight: 800;
      font-size: 12px;
      transition: transform .10s ease, border-color .16s ease, box-shadow .16s ease;
    }

    .btn:hover { transform: translateY(-1px); border-color: var(--line2); box-shadow: 0 10px 22px rgba(16,24,40,.10); }
    .btn:active { transform: translateY(0); }

    .btn.primary {
      background: linear-gradient(135deg, rgba(37,99,235,.14), rgba(14,165,233,.12));
      border-color: rgba(37,99,235,.22);
      color: var(--text);
    }

    .btn.orange {
      background: linear-gradient(135deg, rgba(249,115,22,.16), rgba(37,99,235,.08));
      border-color: rgba(249,115,22,.24);
    }

    .btn.danger {
      background: rgba(225,29,72,.10);
      border-color: rgba(225,29,72,.28);
      color: var(--text);
    }

    .btn.small { padding: 9px 10px; font-weight: 800; }

    .stack { display: flex; flex-wrap: wrap; gap: 10px; }

    .help {
      margin-top: 8px;
      color: var(--faint);
      font-size: 12px;
      line-height: 1.35;
    }

    .log {
      border: 1px solid var(--line);
      background: rgba(255,255,255,.65);
      border-radius: 14px;
      padding: 12px;
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.35;
      white-space: pre-wrap;
      max-height: 420px;
      overflow: auto;
      color: rgba(15,23,42,.92);
    }

    [data-theme="dark"] .log { background: rgba(0,0,0,.20); color: rgba(233,240,255,.84); }

    .statusRow { display:flex; align-items:center; justify-content: space-between; gap: 10px; }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,.55);
      font-size: 12px;
      color: var(--muted);
      font-family: var(--mono);
    }

    [data-theme="dark"] .pill { background: rgba(0,0,0,.18); }

    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--warn); box-shadow: 0 0 0 5px rgba(245,158,11,.15); }
    .dot.ok { background: var(--ok); box-shadow: 0 0 0 5px rgba(22,163,74,.12); }
    .dot.err { background: var(--danger); box-shadow: 0 0 0 5px rgba(225,29,72,.14); }

    .small {
      font-size: 12px;
      color: var(--faint);
      font-family: var(--mono);
    }

    .sidebar h3 {
      margin: 0;
      font-size: 12px;
      letter-spacing: .10em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .sideBlock { margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--line); }

    .sidePath {
      margin-top: 8px;
      border: 1px solid var(--line);
      background: var(--paper2);
      border-radius: 12px;
      padding: 10px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      word-break: break-word;
    }

    .sideBtn { width: 100%; margin-top: 8px; }

    .rep {
      width: 100%;
      text-align: left;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--paper2);
      padding: 10px 12px;
      cursor: pointer;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }
    .rep:hover { border-color: var(--line2); box-shadow: 0 10px 22px rgba(16,24,40,.10); }
    .repActive { border-color: rgba(59,130,246,.55); box-shadow: 0 0 0 4px rgba(59,130,246,.12); }

    .md-h1{ font-size: 20px; margin: 10px 0 6px; }
    .md-h2{ font-size: 16px; margin: 10px 0 6px; }
    .md-h3{ font-size: 14px; margin: 10px 0 6px; }
    .md-p{ margin: 6px 0; color: var(--muted); line-height: 1.5; }
    .md-ul{ margin: 6px 0 6px 18px; color: var(--muted); }
    .md-inline{ font-family: var(--mono); font-size: 12px; padding: 2px 6px; border: 1px solid var(--line); border-radius: 8px; background: rgba(255,255,255,.55); }
    [data-theme="dark"] .md-inline{ background: rgba(0,0,0,.18); }
    .md-code{ background: rgba(0,0,0,.05); border: 1px solid var(--line); border-radius: 14px; padding: 12px; overflow:auto; }
    [data-theme="dark"] .md-code{ background: rgba(0,0,0,.22); }
    .md-sp{ height: 10px; }

    .k { display: inline-block; padding: 2px 6px; border: 1px solid var(--line); border-radius: 8px; background: rgba(255,255,255,.65); font-family: var(--mono); font-size: 12px; color: var(--muted); }
    [data-theme="dark"] .k { background: rgba(0,0,0,.18); }

  </style>
</head>
<body>
  <div class="app">
    <div class="frame">

      <aside class="sidebar">
        <div style="display:flex; align-items:center; justify-content: space-between; gap:10px;">
          <h3>FREYA</h3>
          <span class="pill"><span class="dot" id="dot"></span><span id="pill">idle</span></span>
        </div>

        <div class="sideBlock">
          <h3>Workspace</h3>
          <div class="sidePath" id="sidePath">./freya</div>
          <button class="btn sideBtn" onclick="pickDir()">Select workspace…</button>
          <button class="btn primary sideBtn" onclick="doInit()">Init workspace</button>
          <button class="btn sideBtn" onclick="doUpdate()">Update (preserve data/logs)</button>
          <button class="btn sideBtn" onclick="doHealth()">Health</button>
          <button class="btn sideBtn" onclick="doMigrate()">Migrate</button>
          <div class="help">Dica: se você já tem uma workspace antiga, use <b>Update</b>. Por padrão, <b>data/</b> e <b>logs/</b> não são sobrescritos.</div>
        </div>

        <div class="sideBlock">
          <h3>Atalhos</h3>
          <div class="help"><span class="k">--dev</span> cria dados de exemplo para testar rápido.</div>
          <div class="help"><span class="k">--port</span> muda a porta (default 3872).</div>
        </div>
      </aside>

      <main class="main">
        <div class="topbar">
          <div class="brand"><span class="spark"></span> Local-first status assistant</div>
          <div class="actions">
            <span class="chip" id="chipPort">127.0.0.1:3872</span>
            <button class="toggle" id="themeToggle" onclick="toggleTheme()">Theme</button>
          </div>
        </div>

        <div class="section">
          <h1>Morning, how can I help?</h1>
          <div class="subtitle">Selecione uma workspace e gere relatórios (Executive / SM / Blockers / Daily). Você pode publicar no Discord/Teams com 1 clique.</div>

          <div class="cards">
            <div class="card" onclick="runReport('status')">
              <div class="icon">E</div>
              <div class="title">Executive report</div>
              <div class="desc">Status pronto para stakeholders (entregas, projetos, blockers).</div>
            </div>
            <div class="card" onclick="runReport('sm-weekly')">
              <div class="icon">S</div>
              <div class="title">SM weekly</div>
              <div class="desc">Resumo, wins, riscos e foco da próxima semana.</div>
            </div>
            <div class="card" onclick="runReport('blockers')">
              <div class="icon orange">B</div>
              <div class="title">Blockers</div>
              <div class="desc">Lista priorizada por severidade + idade (pra destravar rápido).</div>
            </div>
            <div class="card" onclick="runReport('daily')">
              <div class="icon">D</div>
              <div class="title">Daily</div>
              <div class="desc">Ontem / Hoje / Bloqueios — pronto pra standup.</div>
            </div>
          </div>

          <div class="grid2">
            <div class="panel">
              <div class="panelHead"><b>Workspace & publish settings</b><span class="small" id="last"></span></div>
              <div class="panelBody">
                <label>Workspace dir</label>
                <div class="row">
                  <input id="dir" placeholder="./freya" />
                  <button class="btn small" onclick="pickDir()">Browse</button>
                </div>
                <div class="help">Escolha a pasta que contém <code>data/</code>, <code>logs/</code> e <code>scripts/</code>.</div>

                <div style="height:12px"></div>

                <label>Discord webhook URL</label>
                <input id="discord" placeholder="https://discord.com/api/webhooks/..." />
                <div style="height:10px"></div>

                <label>Teams webhook URL</label>
                <input id="teams" placeholder="https://..." />
                <div class="help">Os webhooks ficam salvos na workspace em <code>data/settings/settings.json</code>.</div>

                <div style="height:10px"></div>
                <div class="stack">
                  <button class="btn" onclick="saveSettings()">Save settings</button>
                  <button class="btn" onclick="publish('discord')">Publish selected → Discord</button>
                  <button class="btn" onclick="publish('teams')">Publish selected → Teams</button>
                </div>

                <div style="height:14px"></div>

                <div class="help"><b>Dica:</b> clique em um relatório em <i>Reports</i> para ver o preview e habilitar publish/copy.</div>
              </div>
            </div>

            <div class="panel">
              <div class="panelHead">
                <b>Reports</b>
                <div class="stack">
                  <button class="btn small" onclick="refreshReports()">Refresh</button>
                </div>
              </div>
              <div class="panelBody">
                <input id="reportsFilter" placeholder="filter (ex: daily, executive, 2026-01-29)" style="width:100%; margin-bottom:10px" oninput="renderReportsList()" />
                <div id="reportsList" style="display:grid; gap:8px"></div>
                <div class="help">Últimos relatórios em <code>docs/reports</code>. Clique para abrir preview.</div>
              </div>
            </div>

            <div class="panel">
              <div class="panelHead">
                <b>Preview</b>
                <div class="stack">
                  <button class="btn small" onclick="copyOut()">Copy</button>
                  <button class="btn small" onclick="clearOut()">Clear</button>
                </div>
              </div>
              <div class="panelBody">
                <div id="reportPreview" class="log md" style="font-family: var(--sans);"></div>
                <div class="help">O preview renderiza Markdown básico (headers, listas, code). O botão Copy copia o conteúdo completo.</div>
              </div>
            </div>

          </div>
        </div>

      </main>

    </div>
  </div>

<script>
  window.__FREYA_DEFAULT_DIR = "${safeDefault}";
  const $ = (id) => document.getElementById(id);
  const state = { lastReportPath: null, lastText: '', reports: [], selectedReport: null };

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('freya.theme', theme);
    $('themeToggle').textContent = theme === 'dark' ? 'Light' : 'Dark';
  }

  function toggleTheme() {
    const t = localStorage.getItem('freya.theme') || 'light';
    applyTheme(t === 'dark' ? 'light' : 'dark');
  }

  function setPill(kind, text) {
    const dot = $('dot');
    dot.classList.remove('ok','err');
    if (kind === 'ok') dot.classList.add('ok');
    if (kind === 'err') dot.classList.add('err');
    $('pill').textContent = text;
    $('status') && ($('status').textContent = text);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMarkdown(md) {
    const lines = String(md || '').split(/\\r?\\n/);
    let html = '';
    let inCode = false;
    let inList = false;

    const BT = String.fromCharCode(96); // backtick
    const FENCE = BT + BT + BT;
    const inlineCodeRe = /\x60([^\x60]+)\x60/g;

    const closeList = () => {
      if (inList) { html += '</ul>'; inList = false; }
    };

    for (const line of lines) {
      if (line.trim().startsWith(FENCE)) {
        if (!inCode) {
          closeList();
          inCode = true;
          html += '<pre class="md-code"><code>';
        } else {
          inCode = false;
          html += '</code></pre>';
        }
        continue;
      }

      if (inCode) {
        html += escapeHtml(line) + '\n';
        continue;
      }

      const h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        closeList();
        const lvl = h[1].length;
        html += '<h' + lvl + ' class="md-h' + lvl + '">' + escapeHtml(h[2]) + '</h' + lvl + '>';
        continue;
      }

      const li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li) {
        if (!inList) { html += '<ul class="md-ul">'; inList = true; }
        const content = escapeHtml(li[1]).replace(inlineCodeRe, '<code class="md-inline">$1</code>');
        html += '<li>' + content + '</li>';
        continue;
      }

      if (line.trim() === '') {
        closeList();
        html += '<div class="md-sp"></div>';
        continue;
      }

      closeList();
      const p = escapeHtml(line).replace(inlineCodeRe, '<code class="md-inline">$1</code>');
      html += '<p class="md-p">' + p + '</p>';
    }

    closeList();
    if (inCode) html += '</code></pre>';
    return html;
  }

  function setOut(text) {
    state.lastText = text || '';
    const el = $('reportPreview');
    if (el) el.innerHTML = renderMarkdown(state.lastText);
  }

  function clearOut() {
    state.lastText = '';
    const el = $('reportPreview');
    if (el) el.innerHTML = '';
    setPill('ok', 'idle');
  }

  async function copyOut() {
    try {
      await navigator.clipboard.writeText(state.lastText || '');
      setPill('ok','copied');
      setTimeout(() => setPill('ok','idle'), 800);
    } catch (e) {
      setPill('err','copy failed');
    }
  }

  function setLast(p) {
    state.lastReportPath = p;
    $('last').textContent = p ? ('Last report: ' + p) : '';
  }

  function saveLocal() {
    localStorage.setItem('freya.dir', $('dir').value);
  }

  function loadLocal() {
    $('dir').value = (window.__FREYA_DEFAULT_DIR && window.__FREYA_DEFAULT_DIR !== '__FREYA_DEFAULT_DIR__') ? window.__FREYA_DEFAULT_DIR : (localStorage.getItem('freya.dir') || './freya');
    $('sidePath').textContent = $('dir').value || './freya';
    // Always persist the current run's default dir to avoid stale values
    localStorage.setItem('freya.dir', $('dir').value || './freya');
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

  function fmtWhen(ms) {
    try {
      const d = new Date(ms);
      const yy = String(d.getFullYear());
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return yy + '-' + mm + '-' + dd + ' ' + hh + ':' + mi;
    } catch {
      return '';
    }
  }

  async function selectReport(item) {
    const rr = await api('/api/reports/read', { dir: dirOrDefault(), relPath: item.relPath });
    state.selectedReport = item;
    setLast(item.name);
    setOut(rr.text || '');
    renderReportsList();
  }

  function renderReportsList() {
    const list = $('reportsList');
    if (!list) return;
    const q = ($('reportsFilter') ? $('reportsFilter').value : '').trim().toLowerCase();
    const filtered = (state.reports || []).filter((it) => {
      if (!q) return true;
      return (it.name + ' ' + it.kind).toLowerCase().includes(q);
    });

    list.innerHTML = '';
    for (const item of filtered) {
      const btn = document.createElement('button');
      btn.className = 'rep' + (state.selectedReport && state.selectedReport.relPath === item.relPath ? ' repActive' : '');
      btn.type = 'button';
      const meta = fmtWhen(item.mtimeMs);
      btn.innerHTML =
        '<div style="display:flex; gap:10px; align-items:center; justify-content:space-between">'
        + '<div style="min-width:0">'
        + '<div><span style="font-weight:800">' + escapeHtml(item.kind) + '</span> <span style="opacity:.7">—</span> ' + escapeHtml(item.name) + '</div>'
        + '<div style="opacity:.65; font-size:11px; margin-top:4px">' + escapeHtml(item.relPath) + '</div>'
        + '</div>'
        + '<div style="opacity:.7; font-size:11px; white-space:nowrap">' + escapeHtml(meta) + '</div>'
        + '</div>';

      btn.onclick = async () => {
        try {
          await selectReport(item);
        } catch (e) {
          setPill('err', 'open failed');
        }
      };
      list.appendChild(btn);
    }
  }

  async function refreshReports() {
    try {
      const r = await api('/api/reports/list', { dir: dirOrDefault() });
      state.reports = (r.reports || []).slice(0, 50);
      renderReportsList();

      // Auto-select latest if nothing selected yet
      if (!state.selectedReport && state.reports && state.reports[0]) {
        await selectReport(state.reports[0]);
      }
    } catch (e) {
      // ignore
    }
  }

  async function pickDir() {
    try {
      setPill('run','picker…');
      const r = await api('/api/pick-dir', {});
      if (r && r.dir) {
        $('dir').value = r.dir;
        $('sidePath').textContent = r.dir;
      }
      saveLocal();
      setPill('ok','ready');
    } catch (e) {
      setPill('err','picker failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doInit() {
    try {
      saveLocal();
      $('sidePath').textContent = dirOrDefault();
      setPill('run','init…');
      setOut('');
      const r = await api('/api/init', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      await refreshReports();
      setPill('ok','init ok');
    } catch (e) {
      setPill('err','init failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doUpdate() {
    try {
      saveLocal();
      $('sidePath').textContent = dirOrDefault();
      setPill('run','update…');
      setOut('');
      const r = await api('/api/update', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      await refreshReports();
      setPill('ok','update ok');
    } catch (e) {
      setPill('err','update failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doHealth() {
    try {
      saveLocal();
      $('sidePath').textContent = dirOrDefault();
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
      $('sidePath').textContent = dirOrDefault();
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
      $('sidePath').textContent = dirOrDefault();
      setPill('run', name + '…');
      setOut('');
      const r = await api('/api/report', { dir: dirOrDefault(), script: name });
      setOut(r.output);
      setLast(r.reportPath || null);
      if (r.reportText) state.lastText = r.reportText;
      await refreshReports();
      setPill('ok', name + ' ok');
    } catch (e) {
      setPill('err', name + ' failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function saveSettings() {
    try {
      saveLocal();
      setPill('run','saving…');
      await api('/api/settings/save', {
        dir: dirOrDefault(),
        settings: {
          discordWebhookUrl: $('discord').value.trim(),
          teamsWebhookUrl: $('teams').value.trim()
        }
      });
      setPill('ok','saved');
      setTimeout(() => setPill('ok','idle'), 800);
    } catch (e) {
      setPill('err','save failed');
    }
  }

  async function publish(target) {
    try {
      saveLocal();
      if (!state.lastText) throw new Error('Gere um relatório primeiro.');
      const webhookUrl = target === 'discord' ? $('discord').value.trim() : $('teams').value.trim();
      if (!webhookUrl) throw new Error('Configure o webhook antes.');
      setPill('run','publish…');
      await api('/api/publish', { webhookUrl, text: state.lastText });
      setPill('ok','published');
    } catch (e) {
      setPill('err','publish failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  // Expose handlers for inline onclick="..." attributes
  window.doInit = doInit;
  window.doUpdate = doUpdate;
  window.doHealth = doHealth;
  window.doMigrate = doMigrate;
  window.pickDir = pickDir;
  window.runReport = runReport;
  window.publish = publish;
  window.saveSettings = saveSettings;
  window.refreshReports = refreshReports;
  window.renderReportsList = renderReportsList;
  window.copyOut = copyOut;
  window.clearOut = clearOut;
  window.toggleTheme = toggleTheme;

  // init
  applyTheme(localStorage.getItem('freya.theme') || 'light');
  $('chipPort').textContent = location.host;
  loadLocal();

  // Load persisted settings from the workspace
  (async () => {
    try {
      const r = await api('/api/defaults', { dir: dirOrDefault() });
      if (r && r.workspaceDir) {
        $('dir').value = r.workspaceDir;
        $('sidePath').textContent = r.workspaceDir;
      }
      if (r && r.settings) {
        $('discord').value = r.settings.discordWebhookUrl || '';
        $('teams').value = r.settings.teamsWebhookUrl || '';
      }
    } catch (e) {
      // ignore
    }
    refreshReports();
  })();

  setPill('ok','idle');
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
    try {
      if (!req.url) return safeJson(res, 404, { error: 'Not found' });

      if (req.method === 'GET' && req.url === '/') {
        const body = html(dir || './freya');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(body);
        return;
      }

      if (req.url.startsWith('/api/')) {
        const raw = await readBody(req);
        const payload = raw ? JSON.parse(raw) : {};

        const requestedDir = payload.dir || dir || './freya';
        const workspaceDir = normalizeWorkspaceDir(requestedDir);

        if (req.url === '/api/pick-dir') {
          const picked = await pickDirectoryNative();
          return safeJson(res, 200, { dir: picked });
        }

        if (req.url === '/api/defaults') {
          const settings = readSettings(workspaceDir);
          const reports = listReports(workspaceDir).slice(0, 20);
          return safeJson(res, 200, { workspaceDir, settings, reports });
        }

        if (req.url === '/api/settings/save') {
          const incoming = payload.settings || {};
          const saved = writeSettings(workspaceDir, incoming);
          return safeJson(res, 200, { ok: true, settings: { discordWebhookUrl: saved.discordWebhookUrl, teamsWebhookUrl: saved.teamsWebhookUrl } });
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

        if (req.url === '/api/init') {
          const pkg = '@cccarv82/freya';
          const r = await run(guessNpxCmd(), [guessNpxYesFlag(), pkg, 'init', workspaceDir], process.cwd());
          const output = (r.stdout + r.stderr).trim();
          return safeJson(res, r.code === 0 ? 200 : 400, r.code === 0 ? { output } : { error: output || 'init failed', output });
        }

        if (req.url === '/api/update') {
          const pkg = '@cccarv82/freya';
          fs.mkdirSync(workspaceDir, { recursive: true });
          const r = await run(guessNpxCmd(), [guessNpxYesFlag(), pkg, 'init', '--here'], workspaceDir);
          const output = (r.stdout + r.stderr).trim();
          return safeJson(res, r.code === 0 ? 200 : 400, r.code === 0 ? { output } : { error: output || 'update failed', output });
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
