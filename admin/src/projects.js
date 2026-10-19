// scio 管理后台 · 项目复盘管理（P3）
// 与笔记同款编辑器，字段换成 projects schema；发布管线已支持 kind='project'
import { Hono } from 'hono';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { db } from './db.js';
import { renderLayout } from './views.js';
import { SRC_DIR } from './repo.js';

export const projects = new Hono();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
// slug 会拼进文件路径 → 白名单
const SAFE = (s) => String(s ?? '').replace(/[^\w一-龥-]/g, '');

function repoProjects() {
  const root = SRC_DIR ? join(SRC_DIR, 'src/content/projects') : '';
  const out = [];
  try {
    // ★ 原写法在 ESM 里用 require('node:fs') → ReferenceError 被 try 吞掉 → 已发布项目永远读不到（显示 0）
    for (const f of readdirSync(root)) {
      if (!f.endsWith('.md')) continue;
      const text = readFileSync(join(root, f), 'utf8');
      const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] || '';
      out.push({
        slug: f.slice(0, -3),
        title: fm.match(/^title:\s*(.+)$/m)?.[1]?.replace(/^['"]|['"]$/g, '') || f,
        date: fm.match(/^date:\s*(.+)$/m)?.[1]?.trim() || '',
        draft: /^draft:\s*true/m.test(fm),
      });
    }
  } catch {}
  out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return out;
}

projects.get('/projects', (c) => {
  const repo = repoProjects();
  const drafts = db.prepare("SELECT * FROM drafts WHERE kind='project' ORDER BY updated_at DESC").all();
  const body = `
<div class="row" style="justify-content:space-between;margin-bottom:14px">
  <h2 style="margin:0">项目复盘</h2>
  <div class="row"><span class="muted">已发布 ${repo.length} · 草稿 ${drafts.length}</span>
  <a class="btn" href="/admin/projects/new">写新项目</a></div>
</div>
<div class="card flush">
${[...repo.map((r) => ({ state: 'published', ...r })), ...drafts.map((d) => ({ state: 'draft', id: d.id, title: d.title || '（无标题）', slug: d.slug, date: d.updated_at }))].map((r) => `<div class="nrow">
  <div class="nrow-main">
    ${r.state === 'draft'
      ? `<a class="nrow-title" href="/admin/projects/${r.id}/edit">${esc(r.title)}</a>`
      : `<a class="nrow-title" href="/admin/projects/edit?slug=${encodeURIComponent(r.slug)}">${esc(r.title)} <span class="muted">✎</span></a>`}
    <div class="nrow-sub">${esc(r.slug)} · ${esc(String(r.date || '').slice(0, 10))}</div>
  </div>
  <div class="nrow-side"><span class="chip ${r.state}">${r.state === 'draft' ? '草稿' : '已发布'}</span>
  ${r.state === 'draft' ? `<button class="iconbtn del-draft" data-id="${r.id}" title="删除草稿" type="button">✕</button>` : ''}</div>
</div>`).join('') || '<div class="empty">还没有项目</div>'}
</div>
<script>
document.querySelectorAll('.del-draft').forEach((b) => b.addEventListener('click', async () => {
  if (!confirm('删除这份项目草稿？')) return;
  const r = await fetch('/admin/api/drafts/' + b.dataset.id, { method: 'DELETE' });
  if (r.ok) location.reload(); else alert('删除失败');
}));
</script>`;
  return c.html(renderLayout({ title: '项目', user: c.get('user'), active: '/admin/projects', body }));
});

projects.get('/projects/new', (c) => {
  const r = db.prepare("INSERT INTO drafts (kind) VALUES ('project')").run();
  return c.redirect(`/admin/projects/${r.lastInsertRowid}/edit`);
});

// 已发布项目转入编辑（草稿副本）
projects.get('/projects/edit', (c) => {
  const slug = SAFE(c.req.query('slug') || '');
  // SSR 化：已发布项目从 posts 表转入编辑（不再读 md 文件）
  const row = db.prepare("SELECT * FROM posts WHERE kind='project' AND slug=? COLLATE NOCASE").get(slug);
  if (!row) return c.text('找不到项目', 404);
  const fm = {
    description: row.description, period: row.period || undefined, role: row.role || undefined,
    tech: JSON.parse(row.tech || '[]'), tags: JSON.parse(row.tags || '[]'),
    status: row.status || '已完成', link: row.link || undefined, repo: row.repo || undefined,
    date: row.date,
  };
  db.prepare("DELETE FROM drafts WHERE kind='project' AND lower(slug)=lower(?)").run(slug);
  const r = db.prepare("INSERT INTO drafts (kind, slug, title, fm, content_md, published_path) VALUES ('project',?,?,?,?,?)")
    .run(row.slug.toLowerCase(), row.title, JSON.stringify(fm), row.content_md, `project//${row.slug.toLowerCase()}`);
  return c.redirect(`/admin/projects/${r.lastInsertRowid}/edit`);
});

projects.get('/projects/:id/edit', (c) => {
  const d = db.prepare('SELECT * FROM drafts WHERE id=? AND kind=?').get(c.req.param('id'), 'project');
  if (!d) return c.text('草稿不存在', 404);
  const fm = JSON.parse(d.fm || '{}');
  const val = (k) => esc(fm[k] ?? '');
  const techStr = esc(Array.isArray(fm.tech) ? fm.tech.join(', ') : (fm.tech || ''));
  const tagsStr = esc(Array.isArray(fm.tags) ? fm.tags.join(', ') : (fm.tags || ''));
  const regTags = db.prepare('SELECT key, label FROM tags ORDER BY key').all();
  const statusOpts = ['进行中', '已完成', '已归档'].map((s) => `<option ${fm.status === s ? 'selected' : ''}>${s}</option>`).join('');
  const body = `
<div class="row" style="justify-content:space-between;margin-bottom:6px">
  <h2 style="margin:0">${d.published_path ? '编辑项目（已发布）' : '写项目复盘'}</h2>
  <div class="row"><span id="savemark" class="muted"></span><a class="btn ghost" href="/admin/projects">返回列表</a></div>
</div>
<div class="card">
  <div class="fields" style="grid-template-columns:2fr 1fr">
    <div><label>项目名</label><input id="f-title" value="${esc(d.title)}"></div>
    <div><label>slug（文件名）</label><input id="f-slug" value="${esc(d.slug)}"></div>
  </div>
  <div class="fields f3e">
    <div><label>时间段 period（可选）</label><input id="f-period" value="${val('period')}" placeholder="2026.01 – 2026.09"></div>
    <div><label>角色 role（可选）</label><input id="f-role" value="${val('role')}" placeholder="独立开发"></div>
    <div><label>状态</label><select id="f-status">${statusOpts}</select></div>
  </div>
  <div class="fields f3e">
    <div><label>技术栈（逗号分隔）</label><input id="f-tech" value="${techStr}"></div>
    <div><label>标签（可选）</label><input id="f-tags" list="regtags" value="${tagsStr}"><datalist id="regtags">${regTags.map((t) => `<option value="${esc(t.key)}">${esc(t.label)}</option>`).join('')}</datalist></div>
    <div><label>日期</label><input id="f-date" type="date" value="${val('date') || new Date().toISOString().slice(0, 10)}"></div>
  </div>
  <div class="fields" style="grid-template-columns:1fr 1fr">
    <div><label>线上地址（可选）</label><input id="f-link" value="${val('link')}"></div>
    <div><label>仓库（可选）</label><input id="f-repo" value="${val('repo')}"></div>
  </div>
  <label>摘要 description</label><input id="f-desc" value="${val('description')}">
  <input type="hidden" id="d-id" value="${d.id}">
</div>
<div class="row" style="justify-content:space-between;margin:18px 0 8px">
  <div class="hint">正文（Markdown）</div>
  <div class="row"><button id="btn-preview" class="btn ghost sm" type="button">预览</button><button id="btn-publish" class="btn" type="button">保存并发布上线</button></div>
</div>
<div class="ed-grid">
  <textarea id="f-body" class="ed-body" style="min-height:50vh">${esc(d.content_md)}</textarea>
  <div id="preview" class="card ed-preview" style="min-height:50vh"></div>
</div>
<div id="publog" class="card log" style="margin-top:14px;display:none"></div>
<script type="module">
const $ = (id) => document.getElementById(id);
const id = $('d-id').value;
let saveTimer = null;
async function saveDraft() {
  const payload = {
    title: $('f-title').value.trim(),
    category: '', slug: $('f-slug').value.trim(),
    fm: {
      description: $('f-desc').value.trim(),
      date: $('f-date').value, period: $('f-period').value.trim(), role: $('f-role').value.trim(),
      status: $('f-status').value, tech: $('f-tech').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),
      tags: $('f-tags').value.split(/[,，]/).map(s=>s.trim()).filter(Boolean),
      link: $('f-link').value.trim(), repo: $('f-repo').value.trim(),
    },
    content_md: $('f-body').value,
  };
  const mark = $('savemark');
  mark.textContent = '保存中…';
  const r = await fetch('/admin/api/drafts/' + id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  mark.textContent = r.ok ? ('已保存 ' + new Date().toLocaleTimeString()) : ('保存失败 ' + r.status);
}
$('f-body').addEventListener('input', () => { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 1500); });
['f-title','f-slug','f-period','f-role','f-status','f-tech','f-tags','f-date','f-desc','f-link','f-repo'].forEach(i => $(i).addEventListener('change', saveDraft));
const { marked } = await import('/admin/assets/marked.esm.js');
let previewOn = false;
$('btn-preview').addEventListener('click', () => {
  previewOn = !previewOn;
  $('preview').style.display = previewOn ? 'block' : 'none';
  $('btn-preview').textContent = previewOn ? '关闭预览' : '预览';
  if (previewOn) $('preview').innerHTML = marked.parse($('f-body').value);
});
let rT = null;
$('f-body').addEventListener('input', () => { clearTimeout(rT); rT = setTimeout(() => { if (previewOn) $('preview').innerHTML = marked.parse($('f-body').value); }, 500); });
$('btn-publish').addEventListener('click', async () => {
  if (!confirm('保存并构建发布上线？')) return;
  await saveDraft();
  $('btn-publish').disabled = true;
  const log = $('publog'); log.style.display = 'block'; log.textContent = '发布中…\\n';
  try {
    const r = await fetch('/admin/api/publish', { method: 'POST' });
    const rd = r.body.getReader(); const dec = new TextDecoder();
    for (;;) { const { done, value } = await rd.read(); if (done) break; log.textContent += dec.decode(value); log.scrollTop = log.scrollHeight; }
  } catch (err) { log.textContent += '\\n失败: ' + err; }
  $('btn-publish').disabled = false;
});
</script>`;
  return c.html(renderLayout({ title: '编辑项目', user: c.get('user'), active: '/admin/projects', body }));
});
