// scio 管理后台 · 项目复盘管理（P3）
// 与笔记同款编辑器，字段换成 projects schema；发布管线已支持 kind='project'
import { Hono } from 'hono';
import { db } from './db.js';
import { renderLayout, publishDialog } from './views.js';
import { createPreviewToken } from './preview.js';

export const projects = new Hono();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
// slug 会拼进文件路径 → 白名单
const SAFE = (s) => String(s ?? '').replace(/[^\w一-龥-]/g, '');

// 已发布项目 = 查 posts 表（2026-10-26 第二次审查 P1-B）
// ★ 原实现读 src/content/projects/*.md 目录——发布管线 v2 只写库、不再落 md（笔记侧
//   早已改成 listRepoNotes() 查库，项目侧漏改）。后果：发布一个项目，线上 /projects/ 有它、
//   首页银河有它，后台列表却显示「已发布 0」且没有「转入编辑」入口 → 已上线项目改不了。
//   仓库里那篇迁移期孤儿 md 还让自审「项目列表含真实项目」假通过，掩盖了这个 bug。
function repoProjects() {
  return db
    .prepare("SELECT slug, title, date FROM posts WHERE kind='project' ORDER BY date DESC")
    .all()
    .map((r) => ({ slug: r.slug.toLowerCase(), title: r.title, date: r.date }));
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
  const previewToken = createPreviewToken(d.id);
  const siteBase = String(process.env.SCIO_SITE_URL || '').replace(/\/$/, '');
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
    <div><label>技术栈（逗号分隔，最多 5 项）</label><input id="f-tech" value="${techStr}"></div>
    <div><label>标签（可选，最多 5 个）</label><input id="f-tags" list="regtags" value="${tagsStr}"><datalist id="regtags">${regTags.map((t) => `<option value="${esc(t.key)}">${esc(t.label)}</option>`).join('')}</datalist></div>
    <div><label>日期</label><input id="f-date" type="date" value="${val('date') || new Date().toISOString().slice(0, 10)}"></div>
  </div>
  <div class="fields" style="grid-template-columns:1fr 1fr">
    <div><label>线上地址（可选）</label><input id="f-link" value="${val('link')}"></div>
    <div><label>仓库（可选）</label><input id="f-repo" value="${val('repo')}"></div>
  </div>
  <label>摘要 description</label><input id="f-desc" value="${val('description')}">
  <div class="fields" style="grid-template-columns:1fr">
    <div><label>封面 cover（可选，用作分享图 og:image）</label>
      <div class="row"><input id="f-cover" style="flex:1;min-width:0" value="${val('cover')}" placeholder="/images/xxx.webp 或 https://…">
      <button id="btn-cover-upload" class="btn ghost sm" type="button">上传封面</button></div>
      <input id="cover-input" type="file" accept="image/*" hidden></div>
  </div>
  <input type="hidden" id="d-id" value="${d.id}">
  <input type="hidden" id="preview-token" value="${previewToken}">
  <input type="hidden" id="site-base" value="${esc(siteBase)}">
</div>
<div class="row" style="justify-content:space-between;margin:18px 0 0">
  <div class="ed-tabs">
    <button id="tab-edit" class="ed-tab on" type="button">编辑</button>
    <button id="tab-preview" class="ed-tab" data-testid="preview-tab" type="button">预览</button>
    <button id="btn-preview-new" class="btn ghost sm" type="button">↗ 新窗口</button>
    <button id="btn-upload" class="btn ghost sm" data-testid="upload-button" type="button">上传图片</button>
    <input id="file-input" type="file" accept="image/*" hidden>
    <span id="upload-status" class="hint"></span>
  </div>
  <button id="btn-publish" class="btn" type="button">保存并发布这篇</button>
</div>
<div class="ed-grid">
  <textarea id="f-body" class="ed-body" style="min-height:50vh">${esc(d.content_md)}</textarea>
  <iframe id="preview-frame" class="ed-preview" title="草稿真实预览"></iframe>
</div>
<div id="publog" class="card log" style="margin-top:14px;display:none"></div>
${publishDialog()}
<script type="module">
import { initEditor } from '/admin/assets/editor-common.js';
const $ = (id) => document.getElementById(id);
initEditor({
  fieldIds: ['f-title','f-slug','f-period','f-role','f-status','f-tech','f-tags','f-date','f-desc','f-link','f-repo','f-cover'],
  collect: () => ({
    title: $('f-title').value.trim(),
    category: '', slug: $('f-slug').value.trim(),
    fm: {
      description: $('f-desc').value.trim(),
      date: $('f-date').value, period: $('f-period').value.trim(), role: $('f-role').value.trim(),
      // 与 src/config.ts TAG_LIMITS.input 对齐（admin 是纯 JS，不能 import .ts）
      status: $('f-status').value,
      tech: $('f-tech').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 5),
      tags: $('f-tags').value.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 5),
      link: $('f-link').value.trim(), repo: $('f-repo').value.trim(),
      cover: $('f-cover').value.trim(),
    },
    content_md: $('f-body').value,
  }),
});
</script>`;
  return c.html(renderLayout({ title: '编辑项目', user: c.get('user'), active: '/admin/projects', body }));
});
