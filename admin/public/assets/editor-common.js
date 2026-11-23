// 后台编辑器共享逻辑：自动保存 / 图片上传 / 编辑·预览 tab / 发布确认与回显
// ★ 笔记与项目两个编辑器共用这一份，避免 again 双写（历史教训：两处逻辑漂移）。
const $ = (id) => document.getElementById(id);

/** 页内发布确认弹窗（替代原生 confirm，可被自动化点掉）+ 本次范围清单 */
export function createPublishFlow({ planQuery, publishBody, btnId, logId }) {
  const dlg = $('publish-confirm');
  const box = $('publish-plan');
  const okBtn = $('publish-confirm-ok');
  const cancelBtn = $('publish-confirm-cancel');
  const log = $(logId);
  const btn = $(btnId);
  if (!dlg || !btn) return;

  function renderPlan(plan) {
    box.textContent = '';
    okBtn.disabled = false;
    if (!plan || !plan.ok) {
      box.textContent = (plan && plan.error) || '清单读取失败';
      okBtn.disabled = true;
      return;
    }
    const head = document.createElement('div');
    head.className = 'pc-scope';
    head.textContent = plan.scope === 'all' ? '范围：全部草稿' : '范围：仅当前这篇草稿';
    box.appendChild(head);
    const ul = document.createElement('ul');
    ul.className = 'pc-list';
    if (!plan.items.length) {
      const li = document.createElement('li');
      li.textContent = '没有待发布的改动';
      ul.appendChild(li);
      okBtn.disabled = true;
    }
    for (const it of plan.items) {
      const li = document.createElement('li');
      const b = document.createElement('b');
      b.textContent = it.action;
      li.appendChild(b);
      li.appendChild(document.createTextNode('  ' + it.title + '  '));
      const p = document.createElement('span');
      p.className = 'muted';
      p.textContent = it.path;
      li.appendChild(p);
      ul.appendChild(li);
    }
    box.appendChild(ul);
    const note = document.createElement('div');
    note.className = 'pc-notes';
    for (const n of plan.notes || []) {
      const line = document.createElement('div');
      line.textContent = '· ' + n;
      note.appendChild(line);
    }
    box.appendChild(note);
  }

  btn.addEventListener('click', async () => {
    if (typeof window.__beforePublish === 'function') await window.__beforePublish();
    box.textContent = '读取本次发布清单…';
    okBtn.disabled = true;
    dlg.returnValue = '';
    dlg.showModal();
    try {
      const r = await fetch('/admin/api/publish/plan' + planQuery);
      renderPlan(await r.json());
    } catch (e) {
      box.textContent = '清单读取失败: ' + e;
    }
  });
  cancelBtn.addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue !== 'ok') return;
    btn.disabled = true;
    if (log) { log.style.display = 'block'; log.textContent = '发布中…\n'; }
    try {
      const r = await fetch('/admin/api/publish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(publishBody),
      });
      if (!r.ok) {
        if (log) log.textContent += '\n发布被拒绝: ' + (await r.text());
      } else {
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        const emit = (line) => {
          line = line.trim();
          if (!line) return;
          try {
            const o = JSON.parse(line);
            const txt = o.line ?? (o.t === 'ok' ? '发布完成' : o.t);
            if (log) log.textContent += (o.t === 'err' ? '✗ ' : o.t === 'ok' ? '✓ ' : '') + txt + '\n';
          } catch { if (log) log.textContent += line + '\n'; }
          if (log) log.scrollTop = log.scrollHeight;
        };
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) { emit(buf.slice(0, i)); buf = buf.slice(i + 1); }
        }
        if (buf.trim()) emit(buf);
      }
    } catch (err) {
      if (log) log.textContent += '\n发布请求失败: ' + err;
    }
    btn.disabled = false;
  });
}

export function initEditor({ collect, fieldIds = [], bodyId = 'f-body' }) {
  const id = $('d-id').value;
  const token = $('preview-token').value;
  const ta = $(bodyId);
  let saveTimer = null;
  let previewOn = false;

  async function saveDraft() {
    const mark = $('savemark');
    if (mark) mark.textContent = '保存中…';
    try {
      const r = await fetch('/admin/api/drafts/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collect()),
      });
      if (mark) mark.textContent = r.ok ? ('已保存 ' + new Date().toLocaleTimeString()) : ('保存失败 ' + r.status);
      return r.ok;
    } catch {
      if (mark) mark.textContent = '保存失败';
      return false;
    }
  }
  // 供发布流程在弹窗前强制落盘（最新内容一定要进预览/发布）
  window.__beforePublish = saveDraft;

  ta.addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 1500); });
  fieldIds.forEach((fid) => $(fid)?.addEventListener('change', saveDraft));

  // ===== 图片上传：正文 / 封面共用 /admin/api/media，失败写行内状态（不再 alert） =====
  const status = (text, bad = false) => {
    const el = $('upload-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = bad ? 'var(--er)' : '';
  };
  async function uploadImage(file, mode) {
    if (!file) return;
    status('上传中…');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/admin/api/media', { method: 'POST', body: fd });
      const j = await r.json();
      if (!j.ok) { status('上传失败: ' + (j.error || ''), true); return; }
      if (mode === 'cover') {
        $('f-cover').value = '/images/' + j.dest;
        $('f-cover').dispatchEvent(new Event('change'));
        status('封面已上传并保存');
      } else {
        const ins = '\n![' + (j.name || '图') + '](/images/' + j.dest + ')\n';
        const s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + ins + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + ins.length;
        await saveDraft();
        status('图片已插入正文');
        if (previewOn) await refreshPreview();
      }
    } catch (e) { status('上传失败: ' + e, true); }
  }
  $('btn-upload')?.addEventListener('click', () => $('file-input').click());
  $('file-input')?.addEventListener('change', (e) => { uploadImage(e.target.files[0], 'body'); e.target.value = ''; });
  $('btn-cover-upload')?.addEventListener('click', () => $('cover-input').click());
  $('cover-input')?.addEventListener('change', (e) => { uploadImage(e.target.files[0], 'cover'); e.target.value = ''; });
  document.addEventListener('paste', (e) => {
    for (const it of e.clipboardData?.items || []) {
      if (it.type.startsWith('image/')) { e.preventDefault(); uploadImage(it.getAsFile(), 'body'); }
    }
  });
  ta.addEventListener('drop', (e) => {
    for (const f of e.dataTransfer?.files || []) {
      if (f.type.startsWith('image/')) { e.preventDefault(); uploadImage(f, 'body'); }
    }
  });

  // ===== 编辑 / 预览 tab：iframe 指向站点真实模板路由，手机也可见 =====
  const frame = $('preview-frame');
  // 本地是「站点 4321 / 后台 4322」双端口，相对路径会打到后台 → 404；
  // 生产两者同域（Caddy 分流），site-base 为空时退回相对路径。
  const siteBase = ($('site-base')?.value || '').replace(/\/$/, '');
  const previewUrl = () => siteBase + '/draft-preview/' + id + '?t=' + encodeURIComponent(token) + '&v=' + Date.now();
  async function refreshPreview() { await saveDraft(); if (frame) frame.src = previewUrl(); }
  function setTab(on) {
    previewOn = on;
    ta.style.display = on ? 'none' : 'block';
    if (frame) frame.style.display = on ? 'block' : 'none';
    $('tab-edit').classList.toggle('on', !on);
    $('tab-preview').classList.toggle('on', on);
  }
  $('tab-edit').addEventListener('click', () => setTab(false));
  $('tab-preview').addEventListener('click', async () => { setTab(true); await refreshPreview(); });
  $('btn-preview-new').addEventListener('click', async () => { await saveDraft(); window.open(previewUrl(), '_blank'); });

  // ===== 发布：只发当前篇，清单在页内弹窗里确认 =====
  createPublishFlow({
    planQuery: '?draftId=' + encodeURIComponent(id),
    publishBody: { draftId: Number(id) },
    btnId: 'btn-publish', logId: 'publog',
  });

  return { saveDraft, refreshPreview };
}
