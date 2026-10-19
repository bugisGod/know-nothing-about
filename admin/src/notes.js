// scio 管理后台 · 笔记管理（P2）
// 列表（已发布=读仓库 md，草稿=读 SQLite）/ 新建 / 编辑 / 自动保存 / 发布
import { Hono } from 'hono';
import { db } from './db.js';
import { renderLayout } from './views.js';
import { listRepoNotes, noteAsDraftData } from './repo.js';

export const notes = new Hono();

// ★ 分类/slug 直接进文件路径（src/content/notes/<cat>/<slug>.md）——必须白名单，
//   否则 cat=../../.. 就是任意文件读写（发布时还会落到仓库里）
const SAFE = (s) => String(s ?? '').replace(/[^\w一-龥-]/g, '');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// 解析仓库 md 的 frontmatter（轻量：不引 gray-matter，格式自家可控）
export function parseMd(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!kv) continue;
    const [, k, raw] = kv;
    let v = raw.trim();
    if (v.startsWith('[') && v.endsWith(']')) {
      v = v.slice(1, -1).split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    } else if (v === 'true' || v === 'false') v = v === 'true';
    else v = v.replace(/^['"]|['"]$/g, '');
    fm[k] = v;
  }
  return { fm, body: m[2] };
}

export function buildFrontmatter(fm, body) {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fm)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v)) lines.push(`${k}: [${v.map((x) => String(x).includes(' ') ? `"${x}"` : x).join(', ')}]`);
    else if (typeof v === 'boolean') lines.push(`${k}: ${v}`);
    else lines.push(`${k}: ${String(v).includes(':') ? JSON.stringify(String(v)) : v}`);
  }
  lines.push('---', '');
  return lines.join('\n') + body.replace(/\r\n/g, '\n');
}

notes.get('/notes', (c) => {
  const repo = listRepoNotes();
  const drafts = db.prepare("SELECT * FROM drafts WHERE kind='note' ORDER BY updated_at DESC").all();
  const rows = [
    ...repo.map((n) => ({ state: 'published', title: n.title, category: n.category, slug: n.slug, date: n.date, path: n.rel })),
    ...drafts.map((d) => ({ state: 'draft', title: d.title || '（无标题）', category: d.category, slug: d.slug, date: d.updated_at, id: d.id })),
  ];
  const body = `
<div class="row" style="justify-content:space-between;margin-bottom:14px">
  <h2 style="margin:0">笔记</h2>
  <div class="row"><span class="muted">已发布 ${repo.length} · 草稿 ${drafts.length}</span>
  <a class="btn" href="/admin/notes/new">写新笔记</a></div>
</div>
<div class="card flush">
${rows.map((r) => `<div class="nrow">
  <div class="nrow-main">
    ${r.state === 'draft'
      ? `<a href="/admin/notes/${r.id}/edit" class="nrow-title">${esc(r.title)}</a>`
      : `<a href="/admin/notes/edit?cat=${encodeURIComponent(r.category)}&slug=${encodeURIComponent(r.slug)}" class="nrow-title">${esc(r.title)} <span class="muted">✎</span></a>`}
    <div class="nrow-sub">${esc(r.category)} · ${esc(String(r.date || '').slice(0, 10))}</div>
  </div>
  <div class="nrow-side">
    <span class="chip ${r.state}">${r.state === 'draft' ? '草稿' : '已发布'}</span>
    ${r.state === 'draft' ? `<button class="iconbtn del-draft" data-id="${r.id}" title="删除草稿" type="button">✕</button>` : ''}
  </div>
</div>`).join('') || '<div class="empty">还没有内容——点右上「写新笔记」开始</div>'}
</div>
<script>
document.querySelectorAll('.del-draft').forEach((b) => b.addEventListener('click', async () => {
  if (!confirm('删除这份草稿？（已发布的原文不受影响）')) return;
  const r = await fetch('/admin/api/drafts/' + b.dataset.id, { method: 'DELETE' });
  if (r.ok) location.reload(); else alert('删除失败');
}));
</script>`;
  return c.html(renderLayout({ title: '笔记', user: c.get('user'), active: '/admin/notes', body }));
});

// 新建 → 建草稿 → 跳编辑
notes.get('/notes/new', (c) => {
  const r = db.prepare("INSERT INTO drafts (kind) VALUES ('note')").run();
  return c.redirect(`/admin/notes/${r.lastInsertRowid}/edit`);
});

// 编辑草稿（含「已发布文章转入编辑」：按 cat/slug 建草稿副本）
notes.get('/notes/edit', (c) => {
  // ★ 白名单：cat/slug 会拼进文件路径与发布后的仓库路径
  const cat = SAFE(c.req.query('cat') || '');
  const slug = SAFE(c.req.query('slug') || '');
  const data = noteAsDraftData(cat, slug);
  if (!data) return c.text('找不到文章', 404);
  const { fm, body } = data;
  // ★ 去重（2026-10-20）：重复转入编辑会堆副本，回滚后一起重发——先清同目标旧草稿
  db.prepare("DELETE FROM drafts WHERE kind='note' AND category=? AND lower(slug)=lower(?)").run(cat, slug);
  const r = db.prepare("INSERT INTO drafts (kind, category, slug, title, fm, content_md, published_path) VALUES ('note',?,?,?,?,?,?)")
    .run(cat, slug, fm.title || slug, JSON.stringify({ ...fm, title: undefined }), body, `src/content/notes/${cat}/${slug}.md`);
  return c.redirect(`/admin/notes/${r.lastInsertRowid}/edit`);
});

notes.get('/notes/:id/edit', (c) => {
  const d = db.prepare('SELECT * FROM drafts WHERE id=? AND kind=?').get(c.req.param('id'), 'note');
  if (!d) return c.text('草稿不存在', 404);
  const cats = listRepoNotes().map((n) => n.category);
  const catList = [...new Set(cats)];
  const regTags = db.prepare('SELECT key, label FROM tags ORDER BY key').all();
  const body = renderEditor(d, catList, regTags); // ★ 原来漏传 regTags → 编辑器 500
  return c.html(renderLayout({ title: '编辑笔记', user: c.get('user'), body }));
});

function renderEditor(d, catList, regTags = []) {
  const fm = JSON.parse(d.fm || '{}');
  const val = (k) => esc(fm[k] ?? '');
  const tagsStr = esc(Array.isArray(fm.tags) ? fm.tags.join(', ') : (fm.tags || ''));
  return `
<div class="row" style="justify-content:space-between;margin-bottom:6px">
  <h2 style="margin:0">${d.published_path ? '编辑（已发布）' : '写笔记'}</h2>
  <div class="row">
    <span id="savemark" class="muted"></span>
    <a class="btn ghost" href="/admin/notes">返回列表</a>
  </div>
</div>
<div class="card">
  <div class="fields f3">
    <div><label>标题</label><input id="f-title" value="${esc(d.title)}" placeholder="文章标题"></div>
    <div><label>分类（文件夹）</label><input id="f-cat" list="cats" value="${esc(d.category)}" placeholder="如 ai"><datalist id="cats">${catList.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
    <div><label>slug（文件名）</label><input id="f-slug" value="${esc(d.slug)}" placeholder="如 my-note"></div>
  </div>
  <div class="fields f3e">
    <div><label>标签（逗号分隔）</label><input id="f-tags" list="regtags" value="${tagsStr}">
<datalist id="regtags">${regTags.map((t) => `<option value="${esc(t.key)}">${esc(t.label)}</option>`).join('')}</datalist></div>
    <div><label>专栏 series（可选）</label><input id="f-series" value="${val('series')}"></div>
    <div><label>日期</label><input id="f-date" type="date" value="${val('date') || new Date().toISOString().slice(0, 10)}"></div>
  </div>
  <div class="fields f3e">
    <div><label>摘要 description</label><input id="f-desc" value="${val('description')}"></div>
    <div style="display:flex;align-items:flex-end;height:100%;padding-bottom:2px">
      <label class="check"><input type="checkbox" id="f-pinned" ${fm.pinned ? 'checked' : ''}>置顶亮星</label></div>
    <div style="display:flex;align-items:flex-end;height:100%;padding-bottom:2px">
      <label class="check"><input type="checkbox" id="f-draft" ${fm.draft ? 'checked' : ''}>构建时隐藏</label></div>
  </div>
  <input type="hidden" id="d-id" value="${d.id}">
</div>

<div class="row" style="justify-content:space-between;margin:18px 0 8px">
  <div class="hint">正文（Markdown）· 粘贴 / 拖入图片自动上传</div>
  <div class="row">
    <button id="btn-preview" class="btn ghost sm" type="button">预览</button>
    <button id="btn-publish" class="btn" type="button">保存并发布上线</button>
  </div>
</div>
<div class="ed-grid" id="editwrap">
  <textarea id="f-body" class="ed-body" placeholder="# 开始写…">${esc(d.content_md)}</textarea>
  <div id="preview" class="card ed-preview"></div>
</div>
<div id="publog" class="card log" style="margin-top:14px;display:none"></div>
<script type="module">
const $ = (id) => document.getElementById(id);
const id = $('d-id').value;
let saveTimer = null;

async function saveDraft() {
  const fm = {
    description: $('f-desc').value.trim(),
    date: $('f-date').value,
    tags: $('f-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean),
    series: $('f-series').value.trim(),
    pinned: $('f-pinned').checked,
    draft: $('f-draft').checked,
  };
  const payload = {
    title: $('f-title').value.trim(),
    category: $('f-cat').value.trim(),
    slug: $('f-slug').value.trim(),
    fm, content_md: $('f-body').value,
  };
  const mark = $('savemark');
  mark.textContent = '保存中…';
  const r = await fetch('/admin/api/drafts/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  mark.textContent = r.ok ? ('已保存 ' + new Date().toLocaleTimeString()) : ('保存失败 ' + r.status);
}
$('f-body').addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 1500); });
['f-title','f-cat','f-slug','f-tags','f-series','f-date','f-desc'].forEach(idEl =>
  $(idEl).addEventListener('change', saveDraft));

// 预览
const { marked } = await import('/admin/assets/marked.esm.js');
let previewOn = false;
$('btn-preview').addEventListener('click', async () => {
  previewOn = !previewOn;
  const pv = $('preview');
  pv.style.display = previewOn ? 'block' : 'none';
  $('btn-preview').textContent = previewOn ? '关闭预览' : '预览';
  if (previewOn) render();
});
function render() { if (previewOn) $('preview').innerHTML = marked.parse($('f-body').value); }
let rTimer = null;
$('f-body').addEventListener('input', () => { clearTimeout(rTimer); rTimer = setTimeout(render, 500); });

// 图片：粘贴 / 拖入 / 选择
async function uploadImage(file) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/admin/api/media', { method: 'POST', body: fd });
  const j = await r.json();
  if (!j.ok) { alert('上传失败: ' + (j.error || '')); return; }
  const ta = $('f-body');
  const ins = '\\n![' + (j.name || '图') + '](/images/' + j.dest + ')\\n';
  const s = ta.selectionStart;
  ta.value = ta.value.slice(0, s) + ins + ta.value.slice(ta.selectionEnd);
  ta.selectionStart = ta.selectionEnd = s + ins.length;
  saveDraft(); render();
}
document.addEventListener('paste', (e) => {
  for (const it of e.clipboardData.items) {
    if (it.type.startsWith('image/')) { e.preventDefault(); uploadImage(it.getAsFile()); }
  }
});
$('f-body').addEventListener('drop', (e) => {
  for (const f of e.dataTransfer.files) {
    if (f.type.startsWith('image/')) { e.preventDefault(); uploadImage(f); }
  }
});

// 发布
$('btn-publish').addEventListener('click', async () => {
  if (!confirm('保存并构建发布上线？')) return;
  await saveDraft();
  $('btn-publish').disabled = true;
  const log = $('publog');
  log.style.display = 'block'; log.textContent = '发布中…\\n';
  try {
    const r = await fetch('/admin/api/publish', { method: 'POST' });
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      log.textContent += dec.decode(value);
      log.scrollTop = log.scrollHeight;
    }
  } catch (err) { log.textContent += '\\n发布请求失败: ' + err; }
  $('btn-publish').disabled = false;
});
</script>`;
}
