/* FREYA web UI script (served as static asset)
   Keep this file plain JS to avoid escaping issues in inline template literals.
*/

(function () {
  const $ = (id) => document.getElementById(id);
  const state = {
    lastReportPath: null,
    lastText: '',
    reports: [],
    selectedReport: null,
    lastPlan: '',
    lastApplied: null,
    autoApply: true,
    autoRunReports: false,
    prettyPublish: true,
    chatSessionId: null,
    chatLoaded: false
  };

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('freya.theme', theme);
    const t = $('themeToggle');
    if (t) t.textContent = theme === 'dark' ? 'Claro' : 'Escuro';
  }

  function toggleTheme() {
    const t = localStorage.getItem('freya.theme') || 'light';
    applyTheme(t === 'dark' ? 'light' : 'dark');
  }

  function setPill(kind, text) {
    const dot = $('dot');
    if (!dot) return;
    dot.classList.remove('ok', 'err');
    if (kind === 'ok') dot.classList.add('ok');
    if (kind === 'err') dot.classList.add('err');
    const pill = $('pill');
    if (pill) pill.textContent = text;
    const status = $('status');
    if (status) status.textContent = text;
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
    const lines = String(md || '').split(/\r?\n/);
    let html = '';
    let inCode = false;
    let inList = false;

    const NL = String.fromCharCode(10);
    const BT = String.fromCharCode(96);
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
        html += escapeHtml(line) + NL;
        continue;
      }

      const h = line.match(/^(#{1,3})[ \t]+(.*)$/);
      if (h) {
        closeList();
        const lvl = h[1].length;
        html += '<h' + lvl + ' class="md-h' + lvl + '">' + escapeHtml(h[2]) + '</h' + lvl + '>';
        continue;
      }

      const li = line.match(/^[ \t]*[-*][ \t]+(.*)$/);
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

  function ensureChatSession() {
    if (state.chatSessionId) return state.chatSessionId;
    try {
      const fromLocal = localStorage.getItem('freya.chatSessionId');
      if (fromLocal) {
        state.chatSessionId = fromLocal;
        return state.chatSessionId;
      }
    } catch {}

    const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : ('sess-' + Date.now() + '-' + Math.random().toString(16).slice(2, 8));

    state.chatSessionId = id;
    try { localStorage.setItem('freya.chatSessionId', id); } catch {}
    return id;
  }

  async function persistChatItem(item) {
    try {
      const sessionId = ensureChatSession();
      await api('/api/chat/append', {
        dir: dirOrDefault(),
        sessionId,
        role: item.role,
        text: item.text,
        markdown: !!item.markdown,
        ts: item.ts
      });
    } catch {
      // best-effort (chat still works)
    }
  }

  function chatAppend(role, text, opts = {}) {
    const thread = $('chatThread');
    if (!thread) return;

    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + (role === 'user' ? 'user' : 'assistant');

    const meta = document.createElement('div');
    meta.className = 'bubbleMeta';
    meta.textContent = role === 'user' ? 'Você' : 'FREYA';

    const body = document.createElement('div');
    body.className = 'bubbleBody';

    const raw = String(text || '');
    if (opts.markdown) {
      body.innerHTML = renderMarkdown(raw);
    } else {
      body.innerHTML = escapeHtml(raw).replace(/\n/g, '<br>');
    }

    bubble.appendChild(meta);
    bubble.appendChild(body);
    thread.appendChild(bubble);

    // persist
    persistChatItem({ ts: Date.now(), role, markdown: !!opts.markdown, text: raw });

    // keep newest in view
    try {
      thread.scrollTop = thread.scrollHeight;
    } catch {}
  }

  async function loadChatHistory() {
    if (state.chatLoaded) return;
    state.chatLoaded = true;
    const thread = $('chatThread');
    if (!thread) return;

    try {
      const sessionId = ensureChatSession();
      const r = await api('/api/chat/load', { dir: dirOrDefault(), sessionId });
      const items = (r && Array.isArray(r.items)) ? r.items : [];
      if (items.length) {
        thread.innerHTML = '';
        for (const it of items) {
          const role = it.role === 'user' ? 'user' : 'assistant';
          const text = String(it.text || '');
          const markdown = !!it.markdown;
          // render without re-persisting
          const bubble = document.createElement('div');
          bubble.className = 'bubble ' + (role === 'user' ? 'user' : 'assistant');
          const meta = document.createElement('div');
          meta.className = 'bubbleMeta';
          meta.textContent = role === 'user' ? 'Você' : 'FREYA';
          const body = document.createElement('div');
          body.className = 'bubbleBody';
          if (markdown) body.innerHTML = renderMarkdown(text);
          else body.innerHTML = escapeHtml(text).replace(/\n/g, '<br>');
          bubble.appendChild(meta);
          bubble.appendChild(body);
          thread.appendChild(bubble);
        }
        try { thread.scrollTop = thread.scrollHeight; } catch {}
      }
    } catch {
      // ignore
    }
  }

  async function exportChatObsidian() {
    try {
      const sessionId = ensureChatSession();
      setPill('run', 'exportando…');
      const r = await api('/api/chat/export-obsidian', { dir: dirOrDefault(), sessionId });
      const rel = r && r.relPath ? r.relPath : '';
      if (rel) {
        chatAppend('assistant', `Conversa exportada para: **${rel}**`, { markdown: true });
        setPill('ok', 'exportado');
      } else {
        setPill('ok', 'exportado');
      }
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'export falhou');
    }
  }

  async function askFreya() {
    const input = $('inboxText');
    const query = input ? input.value.trim() : '';
    if (!query) {
      setPill('err', 'digite uma pergunta');
      return;
    }

    chatAppend('user', query);
    setPill('run', 'pesquisando…');
    try {
      const sessionId = ensureChatSession();
      const r = await api('/api/chat/ask', { dir: dirOrDefault(), sessionId, query });
      const answer = r && r.answer ? r.answer : 'Não encontrei registro';
      chatAppend('assistant', answer, { markdown: true });
      setPill('ok', 'pronto');
    } catch (e) {
      setPill('err', 'falhou');
      chatAppend('assistant', String(e && e.message ? e.message : e));
    }
  }

  function setOut(text) {
    state.lastText = text || '';
    const el = $('reportPreview');
    if (!el) return;
    try {
      el.innerHTML = renderMarkdown(state.lastText);
    } catch (e) {
      // Fallback: never hide the error/output if markdown rendering breaks
      try { console.error('renderMarkdown failed:', e); } catch {}
      el.textContent = state.lastText;
    }
  }

  function clearOut() {
    state.lastText = '';
    const el = $('reportPreview');
    if (el) el.innerHTML = '';
    setPill('ok', 'pronto');
  }

  async function copyOut() {
    try {
      await navigator.clipboard.writeText(state.lastText || '');
      setPill('ok', 'copied');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'copy failed');
    }
  }

  async function copyPath() {
    try {
      if (!state.selectedReport) {
        setPill('err', 'no report');
        return;
      }
      const r = await api('/api/reports/resolve', { dir: dirOrDefault(), relPath: state.selectedReport.relPath });
      await navigator.clipboard.writeText(r.fullPath || '');
      setPill('ok', 'path copied');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch {
      setPill('err', 'copy path failed');
    }
  }

  async function openSelected() {
    try {
      if (!state.selectedReport) {
        setPill('err', 'no report');
        return;
      }
      setPill('run', 'opening…');
      await api('/api/reports/open', { dir: dirOrDefault(), relPath: state.selectedReport.relPath });
      setPill('ok', 'opened');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch {
      setPill('err', 'open failed');
    }
  }

  function downloadSelected() {
    try {
      if (!state.selectedReport || !state.lastText) {
        setPill('err', 'no report');
        return;
      }
      const blob = new Blob([state.lastText], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = state.selectedReport.name || 'report.md';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPill('ok', 'downloaded');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch {
      setPill('err', 'download failed');
    }
  }

  function setLast(p) {
    state.lastReportPath = p;
    const el = $('last');
    if (el) el.textContent = p ? ('Last report: ' + p) : '';
  }

  function saveLocal() {
    localStorage.setItem('freya.dir', $('dir').value);
    try { localStorage.setItem('freya.autoApply', state.autoApply ? '1' : '0'); } catch {}
    try { localStorage.setItem('freya.autoRunReports', state.autoRunReports ? '1' : '0'); } catch {}
    try { localStorage.setItem('freya.prettyPublish', state.prettyPublish ? '1' : '0'); } catch {}
  }

  function loadLocal() {
    try {
      const v = localStorage.getItem('freya.autoApply');
      if (v !== null) state.autoApply = v === '1';
      const cb = $('autoApply');
      if (cb) cb.checked = !!state.autoApply;

      const v2 = localStorage.getItem('freya.autoRunReports');
      if (v2 !== null) state.autoRunReports = v2 === '1';
      const cb2 = $('autoRunReports');
      if (cb2) cb2.checked = !!state.autoRunReports;

      const v3 = localStorage.getItem('freya.prettyPublish');
      if (v3 !== null) state.prettyPublish = v3 === '1';
      const cb3 = $('prettyPublish');
      if (cb3) cb3.checked = !!state.prettyPublish;
    } catch {}

    const def = (window.__FREYA_DEFAULT_DIR && window.__FREYA_DEFAULT_DIR !== '__FREYA_DEFAULT_DIR__')
      ? window.__FREYA_DEFAULT_DIR
      : (localStorage.getItem('freya.dir') || './freya');
    $('dir').value = def;
    $('sidePath').textContent = def || './freya';
    localStorage.setItem('freya.dir', $('dir').value || './freya');
  }

  async function api(p, body) {
    const res = await fetch(p, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined
    });

    // Read as text first so we can surface errors even if backend returns HTML/plaintext
    const raw = await res.text();
    let json = null;
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch (e) {
      const snippet = (raw || '').slice(0, 1200);
      throw new Error(`Non-JSON response (${res.status} ${res.statusText}) from ${p}:\n\n${snippet}`);
    }

    if (!res.ok) {
      const detail = json.details ? ('\n' + json.details) : '';
      const err = (json.error || `Request failed (${res.status})`) + detail;
      throw new Error(err);
    }
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

  async function refreshReports(opts = {}) {
    try {
      const r = await api('/api/reports/list', { dir: dirOrDefault() });
      state.reports = (r.reports || []).slice(0, 10);
      renderReportsList();

      const latest = state.reports && state.reports[0] ? state.reports[0] : null;
      if (!latest) return;

      if (opts.selectLatest) {
        await selectReport(latest);
        return;
      }

      if (!state.selectedReport) {
        await selectReport(latest);
      }
    } catch (e) {
      // ignore
    }
  }

  async function editTask(t) {
    try {
      const currentSlug = t.projectSlug ? String(t.projectSlug) : '';
      const slug = prompt('projectSlug (ex: vivo/fidelizacao/chg0178682):', currentSlug);
      if (slug === null) return;

      const currentCat = String(t.category || 'DO_NOW');
      const cat = prompt('category (DO_NOW|SCHEDULE|DELEGATE|IGNORE):', currentCat);
      if (cat === null) return;

      setPill('run', 'updating…');
      await api('/api/tasks/update', { dir: dirOrDefault(), id: t.id, patch: { projectSlug: slug, category: cat } });
      await refreshToday();
      setPill('ok', 'updated');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'update failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function editBlocker(b) {
    try {
      const currentSlug = b.projectSlug ? String(b.projectSlug) : '';
      const slug = prompt('projectSlug (ex: vivo/bnpl/dpgc):', currentSlug);
      if (slug === null) return;

      setPill('run', 'updating…');
      await api('/api/blockers/update', { dir: dirOrDefault(), id: b.id, patch: { projectSlug: slug } });
      await refreshToday();
      setPill('ok', 'updated');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'update failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  function renderTasks(list) {
    const el = $('tasksList');
    if (!el) return;
    el.innerHTML = '';
    for (const t of list || []) {
      const row = document.createElement('div');
      row.className = 'rep';
      const pri = (t.priority || '').toUpperCase();
      row.innerHTML = '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center">'
        + '<div style="min-width:0"><div style="font-weight:700">' + escapeHtml(t.description || '') + '</div>'
        + '<div style="opacity:.7; font-size:11px; margin-top:4px">' + escapeHtml(String(t.category || ''))
        + (t.projectSlug ? (' · <span style="font-family:var(--mono); opacity:.9">[' + escapeHtml(String(t.projectSlug)) + ']</span>') : '')
        + (pri ? (' · ' + escapeHtml(pri)) : '') + '</div></div>'
        + '<div style="display:flex; gap:8px">'
        + '<button class="btn small" type="button">Concluir</button>'
        + '<button class="btn small" type="button">Editar</button>'
        + '</div>'
        + '</div>';
      const btns = row.querySelectorAll('button');
      const btn = btns[0];
      if (btns[1]) btns[1].onclick = () => editTask(t);
      btn.onclick = async () => {
        try {
          setPill('run', 'completing…');
          await api('/api/tasks/complete', { dir: dirOrDefault(), id: t.id });
          await refreshToday();
          setPill('ok', 'completed');
          setTimeout(() => setPill('ok', 'pronto'), 800);
        } catch (e) {
          setPill('err', 'complete failed');
          setOut(String(e && e.message ? e.message : e));
        }
      };
      el.appendChild(row);
    }
    if (!el.childElementCount) {
      const empty = document.createElement('div');
      empty.className = 'help';
      empty.textContent = 'Nenhuma tarefa em Fazer agora.';
      el.appendChild(empty);
    }
  }

  function renderBlockers(list) {
    const el = $('blockersList');
    if (!el) return;
    el.innerHTML = '';
    for (const b of list || []) {
      const row = document.createElement('div');
      row.className = 'rep';
      const sev = String(b.severity || '').toUpperCase();
      row.innerHTML = '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center">'
        + '<div style="min-width:0"><div style="font-weight:800">' + escapeHtml(sev) + '</div>'
        + '<div style="margin-top:4px">' + escapeHtml(b.title || '')
        + (b.projectSlug ? (' <span style="font-family:var(--mono); opacity:.8">[' + escapeHtml(String(b.projectSlug)) + ']</span>') : '')
        + '</div>'
        + '</div>'
        + '<div style="display:flex; gap:8px; align-items:center">'
        + '<div style="opacity:.7; font-size:11px; white-space:nowrap">' + escapeHtml(fmtWhen(new Date(b.createdAt || Date.now()).getTime())) + '</div>'
        + '<button class="btn small" type="button">Editar</button>'
        + '</div>'
        + '</div>';
      const ebtn = row.querySelector('button');
      if (ebtn) ebtn.onclick = () => editBlocker(b);
      el.appendChild(row);
    }
    if (!el.childElementCount) {
      const empty = document.createElement('div');
      empty.className = 'help';
      empty.textContent = 'Nenhum bloqueio aberto.';
      el.appendChild(empty);
    }
  }

  async function refreshToday() {
    try {
      const [t, b] = await Promise.all([
        api('/api/tasks/list', { dir: dirOrDefault(), category: 'DO_NOW', status: 'PENDING', limit: 5 }),
        api('/api/blockers/list', { dir: dirOrDefault(), status: 'OPEN', limit: 5 })
      ]);
      renderTasks((t && t.tasks) || []);
      renderBlockers((b && b.blockers) || []);
    } catch (e) {
      // keep silent in background refresh
    }
  }

  async function pickDir() {
    try {
      setPill('run', 'picker…');
      const r = await api('/api/pick-dir', {});
      if (r && r.dir) {
        $('dir').value = r.dir;
        $('sidePath').textContent = r.dir;
      }
      saveLocal();
      setPill('ok', 'ready');
    } catch (e) {
      setPill('err', 'picker failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doInit() {
    try {
      saveLocal();
      $('sidePath').textContent = dirOrDefault();
      setPill('run', 'init…');
      setOut('');
      const r = await api('/api/init', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      await refreshReports({ selectLatest: true });
      // Auto health after init
      try { await doHealth(); } catch {}
      setPill('ok', 'init ok');
    } catch (e) {
      setPill('err', 'init failed');
      const msg = e && (e.stack || e.message) ? (e.stack || e.message) : String(e);
      setOut(msg);
    }
  }

  async function doUpdate() {
    try {
      saveLocal();
      $('sidePath').textContent = dirOrDefault();
      setPill('run', 'update…');
      setOut('');
      const r = await api('/api/update', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      await refreshReports({ selectLatest: true });
      // Auto health after update
      try { await doHealth(); } catch {}
      setPill('ok', 'update ok');
    } catch (e) {
      setPill('err', 'update failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doHealth() {
    try {
      saveLocal();
      $('sidePath').textContent = dirOrDefault();
      setPill('run', 'health…');
      setOut('');
      const r = await api('/api/health', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      setPill('ok', 'health ok');
    } catch (e) {
      setPill('err', 'health failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doMigrate() {
    try {
      saveLocal();
      $('sidePath').textContent = dirOrDefault();
      setPill('run', 'migrate…');
      setOut('');
      const r = await api('/api/migrate', { dir: dirOrDefault() });
      setOut(r.output);
      setLast(null);
      setPill('ok', 'migrate ok');
    } catch (e) {
      setPill('err', 'migrate failed');
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
      await refreshReports({ selectLatest: true });
      setPill('ok', name + ' ok');
    } catch (e) {
      setPill('err', name + ' failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function exportObsidian() {
    try {
      setPill('run', 'exporting…');
      const r = await api('/api/obsidian/export', { dir: dirOrDefault() });
      setOut('## Obsidian export\n\n' + (r.output || 'ok'));
      setPill('ok', 'exported');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'export failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function reloadSlugRules() {
    try {
      const r = await api('/api/project-slug-map/get', { dir: dirOrDefault() });
      const el = $('slugRules');
      if (el) el.value = JSON.stringify(r.map || { rules: [] }, null, 2);
      setPill('ok', 'rules loaded');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'rules load failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function saveSlugRules() {
    try {
      const el = $('slugRules');
      if (!el) return;
      const raw = String(el.value || '').trim();
      if (!raw) throw new Error('Rules JSON is empty');
      let map;
      try { map = JSON.parse(raw); } catch (e) { throw new Error('Invalid JSON: ' + (e.message || e)); }

      setPill('run', 'saving rules…');
      const r = await api('/api/project-slug-map/save', { dir: dirOrDefault(), map });
      if (el) el.value = JSON.stringify(r.map || map, null, 2);
      setPill('ok', 'rules saved');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'rules save failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function saveSettings() {
    try {
      saveLocal();
      setPill('run', 'saving…');
      await api('/api/settings/save', {
        dir: dirOrDefault(),
        settings: {
          discordWebhookUrl: $('discord').value.trim(),
          teamsWebhookUrl: $('teams').value.trim()
        }
      });
      setPill('ok', 'saved');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'save failed');
    }
  }

  async function publish(target) {
    try {
      saveLocal();
      if (!state.lastText) throw new Error('Gere um relatório primeiro.');

      // quick local warning (server also enforces)
      const secretHints = [];
      if (/ghp_[A-Za-z0-9]{20,}/.test(state.lastText)) secretHints.push('GitHub token');
      if (/github_pat_[A-Za-z0-9_]{20,}/.test(state.lastText)) secretHints.push('GitHub fine-grained token');
      if (/-----BEGIN [A-Z ]+PRIVATE KEY-----/.test(state.lastText)) secretHints.push('Private key');
      if (/xox[baprs]-[A-Za-z0-9-]{10,}/.test(state.lastText)) secretHints.push('Slack token');
      if (/AKIA[0-9A-Z]{16}/.test(state.lastText)) secretHints.push('AWS key');

      const msg = secretHints.length
        ? 'ATENÇÃO: possível segredo detectado (' + secretHints.join(', ') + ').\n\nPublicar mesmo assim? (o Freya vai mascarar automaticamente)'
        : 'Publicar o relatório selecionado?';

      const ok = confirm(msg);
      if (!ok) return;

      const webhookUrl = target === 'discord' ? $('discord').value.trim() : $('teams').value.trim();
      if (!webhookUrl) throw new Error('Configure o webhook antes.');
      setPill('run', 'publish…');
      const mode = state.prettyPublish ? 'pretty' : 'chunks';
      await api('/api/publish', { webhookUrl, text: state.lastText, mode, allowSecrets: true });
      setPill('ok', 'published');
    } catch (e) {
      setPill('err', 'publish failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function saveInbox() {
    try {
      const ta = $('inboxText');
      if (!ta) return;
      const text = (ta.value || '').trim();
      if (!text) {
        setPill('err', 'empty');
        return;
      }
      setPill('run', 'saving…');
      await api('/api/inbox/add', { dir: dirOrDefault(), text });
      ta.value = '';
      setPill('ok', 'saved');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'save failed');
    }
  }

  function togglePrettyPublish() {
    const cb = $('prettyPublish');
    state.prettyPublish = cb ? !!cb.checked : true;
    try { localStorage.setItem('freya.prettyPublish', state.prettyPublish ? '1' : '0'); } catch {}
  }

  function toggleAutoRunReports() {
    const cb = $('autoRunReports');
    state.autoRunReports = cb ? !!cb.checked : false;
    try { localStorage.setItem('freya.autoRunReports', state.autoRunReports ? '1' : '0'); } catch {}
  }

  function toggleAutoApply() {
    const cb = $('autoApply');
    state.autoApply = cb ? !!cb.checked : true;
    try { localStorage.setItem('freya.autoApply', state.autoApply ? '1' : '0'); } catch {}
  }

  async function saveAndPlan() {
    try {
      const ta = $('inboxText');
      if (!ta) return;
      const text = (ta.value || '').trim();
      if (!text) {
        setPill('err', 'empty');
        return;
      }

      chatAppend('user', text);

      setPill('run', 'saving…');
      await api('/api/inbox/add', { dir: dirOrDefault(), text });

      setPill('run', 'planning…');
      const r = await api('/api/agents/plan', { dir: dirOrDefault(), text });

      state.lastPlan = r.plan || '';

      // Show plan output in Preview panel
      const header = r.ok === false ? '## Agent Plan (planner unavailable)\n\n' : '## Agent Plan (draft)\n\n';
      const planOut = header + (r.plan || '');
      setOut(planOut);
      chatAppend('assistant', planOut, { markdown: true });
      ta.value = '';

      if (r.ok === false) {
        setPill('err', 'planner off');
        setTimeout(() => setPill('ok', 'pronto'), 800);
        return;
      }

      if (state.autoApply) {
        setPill('run', 'applying…');
        await applyPlan();
        const a = state.lastApplied || {};
        setPill('ok', `applied (${a.tasks || 0}t, ${a.blockers || 0}b)`);
        if (state.autoRunReports) {
          await runSuggestedReports();
        }
      } else {
        setPill('ok', 'planned');
      }

      setTimeout(() => setPill('ok', 'pronto'), 1200);
    } catch (e) {
      setPill('err', 'plan failed');
    }
  }

  async function runSuggestedReports() {
    try {
      const suggested = state.lastApplied && Array.isArray(state.lastApplied.reportsSuggested)
        ? state.lastApplied.reportsSuggested
        : [];
      if (!suggested.length) {
        setPill('err', 'no suggestions');
        return;
      }

      // Dedup + allowlist
      const allow = new Set(['daily', 'status', 'sm-weekly', 'blockers']);
      const uniq = Array.from(new Set(suggested.map((s) => String(s).trim()))).filter((s) => allow.has(s));
      if (!uniq.length) {
        setPill('err', 'no valid');
        return;
      }

      setPill('run', 'running…');
      let out = '## Ran suggested reports\n\n';
      for (const name of uniq) {
        const r = await api('/api/report', { dir: dirOrDefault(), script: name === 'status' ? 'status' : name });
        out += `### ${name}\n` + (r.reportPath ? `- file: ${r.reportPath}\n` : '') + '\n';
      }

      setOut(out);
      await refreshReports({ selectLatest: true });
      setPill('ok', 'done');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'run failed');
    }
  }

  async function applyPlan() {
    try {
      if (!state.lastPlan) {
        setPill('err', 'no plan');
        setOut('## Apply failed\n\nNo plan available. Run **Save + Process (Agents)** first.');
        return;
      }
      setPill('run', 'applying…');
      const r = await api('/api/agents/apply', { dir: dirOrDefault(), plan: state.lastPlan });
      state.lastApplied = r.applied || null;
      const summary = r.applied || {};

      let msg = '## Apply result\n\n' + JSON.stringify(summary, null, 2);
      if (summary && Array.isArray(summary.reportsSuggested) && summary.reportsSuggested.length) {
        msg += '\n\n## Suggested reports\n- ' + summary.reportsSuggested.join('\n- ');
        msg += '\n\nUse: **Rodar relatórios sugeridos** (barra lateral)';
      }

      setOut(msg);
      chatAppend('assistant', msg, { markdown: true });

      // After apply, refresh panels so the UI reflects the new state (tasks/blockers/reports)
      try { await refreshToday(); } catch {}
      try { await refreshReports({ selectLatest: true }); } catch {}

      setPill('ok', 'applied');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      const msg = (e && e.message) ? e.message : String(e);
      setOut('## Apply failed\n\n' + msg);
      setPill('err', 'apply failed');
    }
  }

  // init
  applyTheme(localStorage.getItem('freya.theme') || 'light');
  $('chipPort').textContent = location.host;
  loadLocal();

  // Developer drawer (persist open/close)
  try {
    const d = $('devDrawer');
    if (d) {
      const open = localStorage.getItem('freya.devDrawer') === '1';
      if (open) d.open = true;
      d.addEventListener('toggle', () => {
        try { localStorage.setItem('freya.devDrawer', d.open ? '1' : '0'); } catch {}
      });
    }
  } catch {}

  // Load persisted settings from the workspace + bootstrap (auto-init + auto-health)
  (async () => {
    let defaults = null;
    try {
      defaults = await api('/api/defaults', { dir: dirOrDefault() });
      if (defaults && defaults.workspaceDir) {
        $('dir').value = defaults.workspaceDir;
        $('sidePath').textContent = defaults.workspaceDir;
      }
      if (defaults && defaults.settings) {
        $('discord').value = defaults.settings.discordWebhookUrl || '';
        $('teams').value = defaults.settings.teamsWebhookUrl || '';
      }
    } catch (e) {
      // ignore
    }

    // If workspace isn't initialized yet, auto-init (reduces clicks)
    try {
      if (defaults && defaults.workspaceOk === false) {
        setPill('run', 'auto-init…');
        await doInit();
        // After init, run health automatically
        await doHealth();
      }
    } catch (e) {
      // doInit/doHealth already surfaced errors
    }

    refreshReports();
    refreshToday();
    reloadSlugRules();
    loadChatHistory();
  })();

  setPill('ok', 'pronto');

  // Expose handlers for inline onclick
  window.doInit = doInit;
  window.doUpdate = doUpdate;
  window.doHealth = doHealth;
  window.doMigrate = doMigrate;
  window.pickDir = pickDir;
  window.runReport = runReport;
  window.publish = publish;
  window.saveSettings = saveSettings;
  window.refreshReports = refreshReports;
  window.refreshToday = refreshToday;
  window.reloadSlugRules = reloadSlugRules;
  window.saveSlugRules = saveSlugRules;
  window.exportObsidian = exportObsidian;
  window.renderReportsList = renderReportsList;
  window.copyOut = copyOut;
  window.copyPath = copyPath;
  window.openSelected = openSelected;
  window.downloadSelected = downloadSelected;
  window.clearOut = clearOut;
  window.toggleTheme = toggleTheme;
  window.saveInbox = saveInbox;
  window.saveAndPlan = saveAndPlan;
  window.toggleAutoApply = toggleAutoApply;
  window.toggleAutoRunReports = toggleAutoRunReports;
  window.togglePrettyPublish = togglePrettyPublish;
  window.applyPlan = applyPlan;
  window.runSuggestedReports = runSuggestedReports;
  window.exportChatObsidian = exportChatObsidian;
  window.askFreya = askFreya;
})();
