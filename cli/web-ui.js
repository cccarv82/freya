/* FREYA web UI script (served as static asset)
   Keep this file plain JS to avoid escaping issues in inline template literals.
*/

(function () {
  const $ = (id) => document.getElementById(id);
  const state = {
    lastReportPath: null,
    lastText: '',
    reports: [],
    reportTexts: {},
    reportModes: {},
    reportExpanded: {},
    selectedReport: null,
    lastPlan: '',
    lastApplied: null,
    autoApply: true,
    autoRunReports: false,
    prettyPublish: true,
    timelineProject: '',
    timelineTag: '',
    chatSessionId: null,
    chatLoaded: false
  };

  function applyDarkTheme() {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  function setPill(kind, text) {
    const dot = $('dot');
    const rail = $('railStatus');
    const classes = ['ok', 'err', 'run', 'plan'];
    if (dot) dot.classList.remove(...classes);
    if (rail) rail.classList.remove(...classes);
    if (dot && classes.includes(kind)) dot.classList.add(kind);
    if (rail && classes.includes(kind)) rail.classList.add(kind);
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

    const inlineFormat = (text) => {
      const esc = escapeHtml(text || '');
      const codes = [];
      let out = esc.replace(inlineCodeRe, (_, c) => {
        const idx = codes.length;
        codes.push(c);
        return `@@CODE${idx}@@`;
      });
      out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      out = out.replace(/__(.+?)__/g, '<strong>$1</strong>');
      out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
      out = out.replace(/_(.+?)_/g, '<em>$1</em>');
      out = out.replace(/@@CODE(\d+)@@/g, (_, i) => `<code class="md-inline">${codes[Number(i)]}</code>`);
      return out;
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
        html += '<h' + lvl + ' class="md-h' + lvl + '">' + inlineFormat(h[2]) + '</h' + lvl + '>';
        continue;
      }

      const li = line.match(/^[ \t]*[-*][ \t]+(.*)$/);
      if (li) {
        if (!inList) { html += '<ul class="md-ul">'; inList = true; }
        const content = inlineFormat(li[1]);
        html += '<li>' + content + '</li>';
        continue;
      }

      if (line.trim() === '') {
        closeList();
        html += '<div class="md-sp"></div>';
        continue;
      }

      closeList();
      const p = inlineFormat(line);
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
    const dirEl = $('dir');
    if (dirEl) {
      dirEl.value = def;
      localStorage.setItem('freya.dir', dirEl.value || './freya');
    }
    const side = $('sidePath');
    if (side) side.textContent = def || './freya';
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
    const dEl = $('dir');
    const d = dEl ? dEl.value.trim() : '';
    return d || (localStorage.getItem('freya.dir') || './freya');
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

  function autoGrowTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  async function downloadReportPdf(item) {
    try {
      setPill('run', 'gerando pdf…');
      const res = await fetch('/api/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: dirOrDefault(), relPath: item.relPath })
      });
      if (!res.ok) throw new Error('pdf failed');
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (item.name || 'report').replace(/\.md$/i, '') + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setPill('ok', 'pdf pronto');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'pdf falhou');
    }
  }

  function renderReportsPage() {
    const grid = $('reportsGrid');
    if (!grid) return;
    const q = ($('reportsFilter') ? $('reportsFilter').value : '').trim().toLowerCase();
    const list = (state.reports || []).filter((it) => {
      if (!q) return true;
      return (it.name + ' ' + it.kind).toLowerCase().includes(q);
    });

    grid.innerHTML = '';
    for (const item of list) {
      const card = document.createElement('div');
      const mode = state.reportModes[item.relPath] || 'preview';
      const expanded = state.reportExpanded && state.reportExpanded[item.relPath];
      card.className = 'reportCard' + (mode === 'raw' ? ' raw' : '') + (expanded ? ' expanded' : '');

      const meta = fmtWhen(item.mtimeMs);
      card.innerHTML =
        '<div class="reportHead" data-action="expand">'
        + '<div>'
        + '<div class="reportName">' + escapeHtml(item.name) + '</div>'
        + '<div class="reportMeta">'
        + '<span class="reportMetaText">' + escapeHtml(item.relPath) + ' • ' + escapeHtml(meta) + '</span>'
        + '<button class="iconBtn" data-action="copy" title="Copiar">⧉</button>'
        + '<button class="iconBtn" data-action="pdf" title="Baixar PDF">⬇</button>'
        + '</div>'
        + '</div>'
        + '<div class="reportHeadActions">'
        + '<button class="btn small primary" data-action="save">Salvar</button>'
        + '</div>'
        + '</div>'
        + '<div class="reportBody">'
        + '<div class="reportPreview" contenteditable="true"></div>'
        + '</div>';

      const text = state.reportTexts[item.relPath] || '';
      const preview = card.querySelector('.reportPreview');
      if (preview) preview.innerHTML = renderMarkdown(text || '');

      if (preview) {
        preview.addEventListener('focus', () => {
          preview.dataset.editing = '1';
          preview.textContent = state.reportTexts[item.relPath] || '';
        });
        preview.addEventListener('blur', () => {
          preview.dataset.editing = '';
          const val = preview.innerText || '';
          state.reportTexts[item.relPath] = val;
          preview.innerHTML = renderMarkdown(val);
        });
      }

      const saveBtn = card.querySelector('[data-action="save"]');
      if (saveBtn) {
        saveBtn.onclick = async (ev) => {
          ev.stopPropagation();
          try {
            const content = (raw && typeof raw.value === 'string') ? raw.value : (state.reportTexts[item.relPath] || '');
            setPill('run', 'salvando…');
            await api('/api/reports/write', { dir: dirOrDefault(), relPath: item.relPath, text: content });
            state.reportTexts[item.relPath] = content;
            setPill('ok', 'salvo');
            setTimeout(() => setPill('ok', 'pronto'), 800);
            renderReportsPage();
          } catch (e) {
            setPill('err', 'falhou');
          }
        };
      }

      const copyBtn = card.querySelector('[data-action="copy"]');
      if (copyBtn) {
        copyBtn.onclick = async (ev) => {
          ev.stopPropagation();
          try {
            const html = renderMarkdown(state.reportTexts[item.relPath] || '');
            const text = (preview && preview.innerText) ? preview.innerText : (state.reportTexts[item.relPath] || '');
            const blob = new Blob([`<div>${html}</div>`], { type: 'text/html' });
            const data = [new ClipboardItem({ 'text/html': blob, 'text/plain': new Blob([text], { type: 'text/plain' }) })];
            await navigator.clipboard.write(data);
            setPill('ok', 'copiado');
            setTimeout(() => setPill('ok', 'pronto'), 800);
          } catch {
            try {
              await navigator.clipboard.writeText(state.reportTexts[item.relPath] || '');
              setPill('ok', 'copiado');
              setTimeout(() => setPill('ok', 'pronto'), 800);
            } catch {
              setPill('err', 'copy failed');
            }
          }
        };
      }

      const pdfBtn = card.querySelector('[data-action="pdf"]');
      if (pdfBtn) {
        pdfBtn.onclick = (ev) => {
          ev.stopPropagation();
          downloadReportPdf(item);
        };
      }

      const head = card.querySelector('[data-action="expand"]');
      if (head) {
        head.onclick = (ev) => {
          if (ev.target && ev.target.closest('.reportHeadActions')) return;
          state.reportExpanded[item.relPath] = !state.reportExpanded[item.relPath];
          renderReportsPage();
        };
      }

      grid.appendChild(card);    }
  }

  function renderProjects() {
    const el = $('projectsGrid');
    if (!el) return;
    const filter = String(($('projectsFilter') && $('projectsFilter').value) || '').toLowerCase();
    const items = Array.isArray(state.projects) ? state.projects : [];
    const filtered = items.filter((p) => {
      const hay = [p.client, p.program, p.stream, p.project, p.slug, (p.tags||[]).join(' ')].join(' ').toLowerCase();
      if (kind !== 'all' && String(i.kind||'') !== kind) return false;
      return !filter || hay.includes(filter);
    });
    el.innerHTML = '';
    for (const p of filtered) {
      const card = document.createElement('div');
      card.className = 'reportCard';
      card.innerHTML = '<div class="reportHead">'
        + '<div><div class="reportTitle">' + escapeHtml(p.project || p.slug || 'Projeto') + '</div>'
        + '<div class="reportMeta">' + escapeHtml([p.client, p.program, p.stream].filter(Boolean).join(' · ')) + '</div></div>'
        + '<div class="reportActions">' + (p.active ? '<span class="pill ok">ativo</span>' : '<span class="pill warn">inativo</span>') + '</div>'
        + '</div>'
        + '<div class="help" style="margin-top:8px">' + escapeHtml(p.currentStatus || 'Sem status') + '</div>'
        + '<div class="reportMeta" style="margin-top:8px">Última atualização: ' + escapeHtml(p.lastUpdated || '—') + '</div>'
        + '<div class="reportMeta">Eventos: ' + escapeHtml(String(p.historyCount || 0)) + '</div>';
      el.appendChild(card);
    }
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'help';
      empty.textContent = 'Nenhum projeto encontrado.';
      el.appendChild(empty);
    }
  }

  async function refreshProjects() {
    try {
      const r = await api('/api/projects/list', { dir: dirOrDefault() });
      state.projects = r.projects || [];
      renderProjects();
    } catch (e) {
      const el = $('projectsGrid');
      if (el) el.textContent = 'Falha ao carregar projetos.';
    }
  }

  function renderTimeline() {
    const el = $('timelineGrid');
    if (!el) return;
    const filter = String(($('timelineFilter') && $('timelineFilter').value) || '').toLowerCase();
    const items = Array.isArray(state.timeline) ? state.timeline : [];
    const kind = state.timelineKind || 'all';
    const projectSelect = $('timelineProject');
    const tagSelect = $('timelineTag');
    const getItemSlug = (it) => {
      if (!it) return '';
      if (it.slug) return String(it.slug);
      if (it.kind === 'task' && it.content) return String(it.content);
      return '';
    };
    const collectTimelineOptions = (list) => {
      const slugs = new Set();
      const tags = new Set();
      for (const it of list) {
        const slug = getItemSlug(it);
        if (slug) slugs.add(slug);
        const itTags = Array.isArray(it.tags) ? it.tags : [];
        for (const tag of itTags) {
          const cleaned = String(tag || '').trim();
          if (cleaned) tags.add(cleaned);
        }
      }
      return {
        slugs: Array.from(slugs).sort((a, b) => a.localeCompare(b)),
        tags: Array.from(tags).sort((a, b) => a.localeCompare(b))
      };
    };
    const syncSelect = (selectEl, options, selected, placeholder) => {
      if (!selectEl) return selected;
      const nextSelected = options.includes(selected) ? selected : '';
      selectEl.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = placeholder;
      selectEl.appendChild(allOpt);
      for (const opt of options) {
        const optionEl = document.createElement('option');
        optionEl.value = opt;
        optionEl.textContent = opt;
        selectEl.appendChild(optionEl);
      }
      selectEl.value = nextSelected;
      return nextSelected;
    };
    const options = collectTimelineOptions(items);
    const selectedProject = syncSelect(projectSelect, options.slugs, state.timelineProject || '', 'Todos projetos');
    const selectedTag = syncSelect(tagSelect, options.tags, state.timelineTag || '', 'Todas tags');
    state.timelineProject = selectedProject;
    state.timelineTag = selectedTag;
    const filtered = items.filter((i) => {
      const slug = getItemSlug(i);
      if (state.timelineProject && slug !== state.timelineProject) return false;
      if (state.timelineTag) {
        const itTags = Array.isArray(i.tags) ? i.tags.map((t) => String(t)) : [];
        if (!itTags.includes(state.timelineTag)) return false;
      }
      const hay = [i.kind, i.title, i.content, i.slug, (i.tags || []).join(' ')].join(' ').toLowerCase();
      return !filter || hay.includes(filter);
    });
    el.innerHTML = '';
    let currentDate = null;
    for (const it of filtered) {
      if (it.date && it.date !== currentDate) {
        currentDate = it.date;
        const head = document.createElement('div');
        head.className = 'help';
        head.style.fontWeight = '800';
        head.style.marginTop = '6px';
        head.textContent = currentDate;
        el.appendChild(head);
      }
      const card = document.createElement('div');
      card.className = 'reportCard';
      card.innerHTML = '<div class="reportHead">'
        + '<div><div class="reportTitle">' + escapeHtml(it.title || 'Evento') + '</div>'
        + '<div class="reportMeta">' + escapeHtml(it.date || '') + ' · ' + escapeHtml(it.kind || '') + '</div></div>'
        + '<div class="reportActions">'
        + '<span class="pill info">' + escapeHtml(it.kind || '') + '</span>'
        + (it.slug ? ('<span class="pill">' + escapeHtml(it.slug) + '</span>') : '')
        + '</div>'
        + '</div>'
        + '<div class="help" style="margin-top:8px">' + escapeHtml(it.content || '') + '</div>';
      el.appendChild(card);
    }
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'help';
      empty.textContent = 'Nenhum evento encontrado.';
      el.appendChild(empty);
    }
  }

  function setTimelineKind(kind) {
    state.timelineKind = kind;
    renderTimeline();
  }

  function setTimelineProject(project) {
    state.timelineProject = String(project || '');
    renderTimeline();
  }

  function setTimelineTag(tag) {
    state.timelineTag = String(tag || '');
    renderTimeline();
  }

  async function refreshTimeline() {
    try {
      const r = await api('/api/timeline', { dir: dirOrDefault() });
      state.timeline = r.items || [];
      renderTimeline();
    } catch (e) {
      const el = $('timelineGrid');
      if (el) el.textContent = 'Falha ao carregar timeline.';
    }
  }

  async function refreshIncidents() {
    try {
      const r = await api('/api/incidents', { dir: dirOrDefault() });
      const el = $('incidentsBox');
      if (el) {
        const md = r.markdown || '';
        if (!md) { el.innerHTML = '<div class="help">Nenhum incidente registrado.</div>'; return; }
        const lines = md.split(/\n/);
        const cards = [];
        let current = null;
        for (const line of lines) {
          if (line.startsWith('- **')) {
            if (current) cards.push(current);
            current = { title: line.replace('- **', '').replace('**', '').trim(), body: [] };
          } else if (current && line.trim().startsWith('- ')) {
            current.body.push(line.trim().replace(/^- /, ''));
          }
        }
        if (current) cards.push(current);
        el.innerHTML = '';
        if (!cards.length) { el.innerHTML = renderMarkdown(md); return; }
        for (let idx = 0; idx < cards.length; idx++) {
          const c = cards[idx];
          const card = document.createElement('div');
          card.className = 'reportCard';
          const dateLine = c.body.find((b)=> b.toLowerCase().includes('data'));
          const impactLine = c.body.find((b)=> b.toLowerCase().includes('descricao') || b.toLowerCase().includes('impacto'));
          const statusLine = c.body.find((b)=> /^status\s*:/i.test(b));
          const statusRaw = statusLine ? statusLine.split(':').slice(1).join(':').trim().toLowerCase() : '';
          let statusKey = '';
          if (['open', 'aberto', 'aberta'].includes(statusRaw)) statusKey = 'open';
          else if (['mitigating', 'mitigando', 'mitigacao', 'mitigação'].includes(statusRaw)) statusKey = 'mitigating';
          else if (['resolved', 'resolvido', 'resolvida', 'closed', 'fechado', 'fechada'].includes(statusRaw)) statusKey = 'resolved';

          card.innerHTML = '<div class="reportTitle">' + escapeHtml(c.title) + '</div>'
            + (dateLine ? ('<div class="reportMeta">' + escapeHtml(dateLine) + '</div>') : '')
            + (impactLine ? ('<div class="help" style="margin-top:4px">' + escapeHtml(impactLine) + '</div>') : '')
            + c.body.filter((b)=> b!==dateLine && b!==impactLine && b!==statusLine).map((b) => '<div class="help" style="margin-top:4px">' + escapeHtml(b) + '</div>').join('');

          if (statusKey) {
            const actions = document.createElement('div');
            actions.className = 'reportActions';
            actions.style.display = 'flex';
            actions.style.gap = '8px';
            actions.style.marginTop = '8px';
            actions.style.flexWrap = 'wrap';

            const label = statusKey === 'open' ? 'aberto' : (statusKey === 'mitigating' ? 'mitigando' : 'resolvido');
            const pillClass = statusKey === 'resolved' ? 'ok' : (statusKey === 'mitigating' ? 'info' : 'warn');
            const pill = document.createElement('span');
            pill.className = 'pill ' + pillClass;
            pill.textContent = label;
            actions.appendChild(pill);

            if (statusKey !== 'resolved') {
              const btn = document.createElement('button');
              btn.className = 'btn small';
              btn.type = 'button';
              btn.textContent = 'Marcar resolvido';
              btn.onclick = async () => {
                await api('/api/incidents/resolve', { dir: dirOrDefault(), title: c.title, index: idx });
                await refreshIncidents();
              };
              actions.appendChild(btn);
            }

            card.appendChild(actions);
          }

          el.appendChild(card);
        }
      }
    } catch {
      const el = $('incidentsBox');
      if (el) el.textContent = 'Falha ao carregar incidentes.';
    }
  }

  function setHeatmapSort(sort) {
    state.heatmapSort = sort;
    refreshHeatmap();
  }

  async function refreshHeatmap() {
    try {
      const r = await api('/api/tasks/heatmap', { dir: dirOrDefault() });
      const el = $('heatmapGrid');
      if (!el) return;
      el.innerHTML = '';
      let items = r.items || [];
      const sort = state.heatmapSort || 'pending';
      items = items.slice().sort((a,b)=> (b[sort]||0) - (a[sort]||0));
      for (const it of items) {
        const row = document.createElement('div');
        row.className = 'rep';
        const priority = String(it.priority || '').toLowerCase();
        const pill = priority ? ('<span class="pill ' + (priority === 'high' ? 'warn' : (priority === 'medium' ? 'info' : '')) + '">' + escapeHtml(priority) + '</span>') : '';
        const action = it.linkRel ? ('<button class="btn small" type="button" data-link="' + escapeHtml(it.linkRel) + '">Abrir status</button>') : '';
        row.innerHTML = '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center">'
          + '<div style="min-width:0"><div style="font-weight:800">' + escapeHtml(it.slug || 'unassigned') + '</div>'
          + '<div class="help" style="margin-top:4px">Total: ' + escapeHtml(String(it.total)) + ' · Pendentes: ' + escapeHtml(String(it.pending)) + ' · Concluidas: ' + escapeHtml(String(it.completed)) + '</div></div>'
          + '<div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">' + pill + action + '</div>'
          + '</div>';
        const btn = row.querySelector('button[data-link]');
        if (btn) {
          btn.onclick = async () => {
            await api('/api/reports/open', { dir: dirOrDefault(), relPath: btn.getAttribute('data-link') });
          };
        }
        el.appendChild(row);
      }
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'help';
        empty.textContent = 'Sem dados de tasks.';
        el.appendChild(empty);
      }
    } catch {
      const el = $('heatmapGrid');
      if (el) el.textContent = 'Falha ao carregar heatmap.';
    }
  }

  async function refreshReportsPage() {
    try {
      setPill('run', 'carregando…');
      const r = await api('/api/reports/list', { dir: dirOrDefault() });
      state.reports = (r.reports || []);
      state.reportTexts = {};
      await Promise.all(state.reports.map(async (item) => {
        try {
          const rr = await api('/api/reports/read', { dir: dirOrDefault(), relPath: item.relPath });
          state.reportTexts[item.relPath] = rr.text || '';
        } catch {
          state.reportTexts[item.relPath] = '';
        }
      }));
      renderReportsPage();
      setPill('ok', 'pronto');
    } catch (e) {
      setPill('err', 'falhou');
    }
  }

  function wireRailNav() {
    const dash = $('railDashboard');
    const rep = $('railReports');
    const proj = $('railProjects');
    const tl = $('railTimeline');
    const health = $('railCompanion');
    if (dash) {
      dash.onclick = () => {
        const isReports = document.body && document.body.dataset && document.body.dataset.page === 'reports';
        if (isReports) {
          window.location.href = '/';
          return;
        }
        const c = document.querySelector('.centerBody');
        if (c) c.scrollTo({ top: 0, behavior: 'smooth' });
      };
    }
    if (rep) {
      rep.onclick = () => {
        const isReports = document.body && document.body.dataset && document.body.dataset.page === 'reports';
        if (!isReports) window.location.href = '/reports';
      };
    }
    if (proj) {
      proj.onclick = () => {
        const isProjects = document.body && document.body.dataset && document.body.dataset.page === 'projects';
        if (!isProjects) window.location.href = '/projects';
      };
    }
    if (tl) {
      tl.onclick = () => {
        const isTimeline = document.body && document.body.dataset && document.body.dataset.page === 'timeline';
        if (!isTimeline) window.location.href = '/timeline';
      };
    }
    if (health) {
      health.onclick = () => {
        const isHealth = document.body && document.body.dataset && document.body.dataset.page === 'companion';
        if (!isHealth) window.location.href = '/companion';
      };
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
      refreshBlockersInsights();
    } catch (e) {
      // keep silent in background refresh
    }
  }

  function renderBlockersInsights(payload) {
    const el = $('blockersInsights');
    if (!el) return;
    if (!payload || !payload.summary) {
      el.textContent = 'Sem insights no momento.';
      return;
    }
    const lines = [];
    lines.push('<div class="help" style="margin-bottom:6px"><b>Resumo:</b> ' + escapeHtml(payload.summary) + '</div>');
    if (payload.suggestions && payload.suggestions.length) {
      lines.push('<div class="help"><b>Proximos passos:</b></div>');
      lines.push('<ul style="margin:6px 0 0 18px; padding:0;">' + payload.suggestions.map((s) => '<li class="help">' + escapeHtml(s) + '</li>').join('') + '</ul>');
    }
    if (payload.top && payload.top.length) {
      lines.push('<div class="help" style="margin-top:8px"><b>Top blockers:</b></div>');
      lines.push('<ul style="margin:6px 0 0 18px; padding:0;">' + payload.top.map((b) => '<li class="help">' + escapeHtml(String(b.severity || '')) + ' - ' + escapeHtml(String(b.title || '')) + '</li>').join('') + '</ul>');
    }
    el.innerHTML = lines.join('');
  }

  async function refreshBlockersInsights() {
    try {
      const r = await api('/api/blockers/summary', { dir: dirOrDefault() });
      renderBlockersInsights(r);
    } catch (e) {
      const el = $('blockersInsights');
      if (el) el.textContent = 'Falha ao carregar insights.';
    }
  }

  async function pickDir() {
    try {
      setPill('run', 'picker…');
      const r = await api('/api/pick-dir', {});
      if (r && r.dir) {
        $('dir').value = r.dir;
        const sp = $('sidePath');
      if (sp) sp.textContent = r.dir;
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
      const sp = $('sidePath');
      if (sp) sp.textContent = dirOrDefault();
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
      const sp = $('sidePath');
      if (sp) sp.textContent = dirOrDefault();
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

  function renderHealthChecklist(items) {
    const el = $('healthChecklist');
    if (!el) return;
    el.innerHTML = '';
    const list = Array.isArray(items) ? items : [];
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'help';
      empty.textContent = 'Sem checks disponiveis.';
      el.appendChild(empty);
      return;
    }
    for (const it of list) {
      const row = document.createElement('div');
      row.className = 'rep';
      const status = String(it.status || 'info');
      row.innerHTML = '<div style="display:flex; justify-content:space-between; gap:10px; align-items:center">'
        + '<div style="min-width:0"><div style="font-weight:800">' + escapeHtml(it.label || '') + '</div>'
        + '<div class="help" style="margin-top:4px">' + escapeHtml(it.detail || '') + '</div></div>'
        + '<div class="pill ' + escapeHtml(status) + '">' + escapeHtml(status) + '</div>'
        + '</div>';
      el.appendChild(row);
    }
  }

  async function refreshHealthChecklist() {
    try {
      setPill('run', 'checklist…');
      const r = await api('/api/companion/checklist', { dir: dirOrDefault() });
      if (r && r.needsInit) {
        setOut(r.error || 'Workspace not initialized');
        setPill('plan', 'needs init');
        renderHealthChecklist([]);
        return;
      }
      renderHealthChecklist(r.items || []);
      setPill('ok', 'pronto');
    } catch (e) {
      setPill('err', 'checklist failed');
      const el = $('healthChecklist');
      if (el) el.textContent = 'Falha ao carregar checklist.';
    }
  }

  async function refreshExecutiveSummary() {
    const el = $('executiveSummary');
    if (el) el.textContent = 'Carregando resumo...';
    try {
      const r = await api('/api/summary/executive', { dir: dirOrDefault() });
      if (!el) return;
      el.textContent = r.summary || 'Sem resumo disponível.';
    } catch {
      if (el) el.textContent = 'Falha ao carregar resumo.';
    }
  }

  async function refreshAnomalies() {
    const el = $('anomaliesBox');
    if (el) el.innerHTML = '<div class="help">Carregando anomalias...</div>';
    try {
      const r = await api('/api/anomalies', { dir: dirOrDefault() });
      if (!el) return;
      const anomalies = (r && r.anomalies) ? r.anomalies : {};
      const tasksMissing = anomalies.tasksMissingProject || { count: 0, samples: [] };
      const statusMissing = anomalies.statusMissingHistory || { count: 0, samples: [] };

      const rows = [];
      const pushRow = (label, data) => {
        const status = data.count > 0 ? 'warn' : 'ok';
        const samples = (data.samples || []).slice(0, 5).map((s) => `<div class=\"help\" style=\"margin-top:4px\">${escapeHtml(s)}</div>`).join('');
        rows.push(
          `<div class=\"rep\">`
          + `<div style=\"display:flex; justify-content:space-between; gap:10px; align-items:center\">`
          + `<div style=\"min-width:0\"><div style=\"font-weight:800\">${escapeHtml(label)}</div>`
          + `<div class=\"help\" style=\"margin-top:4px\">${data.count} ocorrência(s)</div>`
          + `${samples}</div>`
          + `<div class=\"pill ${status}\">${status}</div>`
          + `</div>`
          + `</div>`
        );
      };

      pushRow('Tarefas sem projectSlug', tasksMissing);
      pushRow('Status sem history', statusMissing);
      el.innerHTML = rows.join('') || '<div class="help">Sem anomalias.</div>';
    } catch {
      if (el) el.innerHTML = '<div class="help">Falha ao carregar anomalias.</div>';
    }
  }

  async function doHealth() {
    try {
      saveLocal();
      const sp = $('sidePath');
      if (sp) sp.textContent = dirOrDefault();
      setPill('run', 'health…');
      setOut('');
      const r = await api('/api/health', { dir: dirOrDefault() });
      if (r && r.needsInit) {
        setOut(r.error || 'Workspace not initialized');
        setLast(null);
        setPill('plan', 'needs init');
        return;
      }
      setOut(r.output);
      setLast(null);
      setPill('ok', 'health ok');
      if (isCompanionPage) {
        refreshHealthChecklist();
      }
    } catch (e) {
      setPill('err', 'health failed');
      setOut(String(e && e.message ? e.message : e));
    }
  }

  async function doMigrate() {
    try {
      saveLocal();
      const sp = $('sidePath');
      if (sp) sp.textContent = dirOrDefault();
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
      const sp = $('sidePath');
      if (sp) sp.textContent = dirOrDefault();
      setPill('run', name + '…');
      setOut('');
      const r = await api('/api/report', { dir: dirOrDefault(), script: name });
      setOut(r.output);
      setLast(r.reportPath || null);
      if (r.reportText) state.lastText = r.reportText;
      await refreshReports({ selectLatest: true });
      if (isCompanionPage) {
        refreshHealthChecklist();
      }
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

  async function rebuildIndex() {
    try {
      setPill('run', 'indexing…');
      const r = await api('/api/index/rebuild', { dir: dirOrDefault() });
      setOut('## Index rebuild\n\n' + (r.output || 'ok'));
      setPill('ok', 'indexed');
      setTimeout(() => setPill('ok', 'pronto'), 800);
    } catch (e) {
      setPill('err', 'index failed');
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
  applyDarkTheme();
  const chipPort = $('chipPort');
  if (chipPort) chipPort.textContent = location.host;
  loadLocal();
  wireRailNav();

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

  const isReportsPage = document.body && document.body.dataset && document.body.dataset.page === 'reports';
  const isProjectsPage = document.body && document.body.dataset && document.body.dataset.page === 'projects';
  const isTimelinePage = document.body && document.body.dataset && document.body.dataset.page === 'timeline';
  const isCompanionPage = document.body && document.body.dataset && document.body.dataset.page === 'companion';

  // Load persisted settings from the workspace + bootstrap (auto-init + auto-health)
  (async () => {
    let defaults = null;
    try {
      defaults = await api('/api/defaults', { dir: dirOrDefault() });
      if (defaults && defaults.workspaceDir) {
        const dirEl = $('dir');
        if (dirEl) dirEl.value = defaults.workspaceDir;
        const side = $('sidePath');
        if (side) side.textContent = defaults.workspaceDir;
      }
      if (defaults && defaults.settings) {
        const discord = $('discord');
        const teams = $('teams');
        if (discord) discord.value = defaults.settings.discordWebhookUrl || '';
        if (teams) teams.value = defaults.settings.teamsWebhookUrl || '';
      }
    } catch (e) {
      // ignore
    }

    if (isReportsPage) {
      await refreshReportsPage();
      return;
    }

    if (isProjectsPage) {
      await refreshProjects();
      return;
    }

    if (isTimelinePage) {
      await refreshTimeline();
      return;
    }

    if (isCompanionPage) {
      await refreshHealthChecklist();
      await refreshExecutiveSummary();
      await refreshAnomalies();
      await refreshIncidents();
      await refreshHeatmap();
      return;
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
  window.rebuildIndex = rebuildIndex;
  window.renderReportsList = renderReportsList;
  window.renderReportsPage = renderReportsPage;
  window.refreshReportsPage = refreshReportsPage;
  window.refreshProjects = refreshProjects;
  window.refreshTimeline = refreshTimeline;
  window.refreshIncidents = refreshIncidents;
  window.refreshHeatmap = refreshHeatmap;
  window.setHeatmapSort = setHeatmapSort;
  window.setTimelineKind = setTimelineKind;
  window.refreshBlockersInsights = refreshBlockersInsights;
  window.refreshHealthChecklist = refreshHealthChecklist;
  window.refreshExecutiveSummary = refreshExecutiveSummary;
  window.refreshAnomalies = refreshAnomalies;
  window.copyOut = copyOut;
  window.copyPath = copyPath;
  window.openSelected = openSelected;
  window.downloadSelected = downloadSelected;
  window.clearOut = clearOut;
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
