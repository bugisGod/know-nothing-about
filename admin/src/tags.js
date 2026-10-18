// scio 管理后台 · 标签管理（P3）
// 注册表 CRUD + 从仓库文章自动发现未注册标签 + 发布时导出 src/data/tags.json
import { Hono } from 'hono';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from './db.js';
import { renderLayout } from './views.js';
import { SRC_DIR } from './repo.js';

export const tags = new Hono();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// 仓库文章里实际用到的标签（key → 次数）
export function discoverRepoTags() {
  const root = join(SRC_DIR, 'src/content');
  const used = new Map();
  const walk = (dir) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (f.name.endsWith('.md')) {
        const m = readFileSync(p, 'utf8').match(/^---[\s\S]*?---/);
        if (!m) continue;
        const tm = m[0].match(/^tags:\s*\[(.*)\]$/m);
        if (!tm) continue;
        for (const t of tm[1].split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)) {
          used.set(t, (used.get(t) || 0) + 1);
        }
      }
    }
  };
  walk(root);
  return used;
}

export function registryJson() {
  const rows = db.prepare('SELECT key, label, desc, color FROM tags').all();
  return Object.fromEntries(rows.map((r) => [r.key, { label: r.label, ...(r.desc ? { desc: r.desc } : {}), ...(r.color ? { color: r.color } : {}) }]));
}

tags.get('/tags', (c) => {
  const reg = db.prepare('SELECT * FROM tags ORDER BY key').all();
  const used = (() => { try { return discoverRepoTags(); } catch { return new Map(); } })();
  const regKeys = new Set(reg.map((r) => r.key));
  const unregistered = [...used.entries()].filter(([k]) => !regKeys.has(k));
  const body = `
<h2>标签</h2>
<p class="hint" style="margin-bottom:14px">注册表决定标签在站点上的显示名与点色；未注册的标签按原文显示。发布时自动同步到站点。</p>
${unregistered.length ? `<div class="card" style="margin-bottom:14px;border-color:var(--ac)">
<div style="font-weight:600;margin-bottom:10px">发现 ${unregistered.length} 个未注册标签（文章里在用）</div>
<div class="row">${unregistered.map(([k, n]) => `<form method="post" action="/admin/tags/quick">
<input type="hidden" name="key" value="${esc(k)}">
<button class="btn ghost sm" type="submit" title="用原文做显示名，一键注册">${esc(k)} · ${n} 篇 +</button></form>`).join('')}</div></div>` : ''}
<div class="card flush">
  <div class="tagrow taghead"><span>key</span><span>显示名</span><span>点色</span><span>使用</span><span></span></div>
  ${reg.map((r) => `
  <form method="post" action="/admin/tags/update" class="tagrow">
    <span><code>${esc(r.key)}</code><input type="hidden" name="key" value="${esc(r.key)}"></span>
    <span><input name="label" value="${esc(r.label)}" aria-label="显示名"></span>
    <span><input name="color" value="${esc(r.color || '')}" placeholder="#d9b879" aria-label="点色"></span>
    <span class="muted">${used.get(r.key) || 0} 篇</span>
    <span class="row" style="gap:6px;justify-content:flex-end">
      <button class="btn ghost sm" type="submit">存</button>
      <button class="btn ghost sm danger" type="submit" formaction="/admin/tags/delete"
        onclick="return confirm('删除 ${esc(r.key)} 的注册？文章里的标签不受影响，之后按原文显示')">删</button>
    </span>
  </form>`).join('') || '<div class="empty">还没有注册任何标签</div>'}
</div>
<div class="card" style="margin-top:16px"><div style="font-weight:600;margin-bottom:10px">注册新标签</div>
<form method="post" action="/admin/tags/create" class="row" style="gap:10px">
<input name="key" placeholder="key（文章里写的）" required style="flex:1;min-width:160px">
<input name="label" placeholder="显示名" required style="flex:1;min-width:160px">
<input name="color" placeholder="#色值 可选" style="width:120px">
<button class="btn" type="submit">添加</button></form></div>
<style>
.tagrow{display:grid;grid-template-columns:1.1fr 1.3fr .8fr .6fr auto;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--bd)}
.tagrow:last-child{border-bottom:0}
.tagrow input{padding:7px 10px}
.taghead{color:var(--muted);font-size:12.5px;letter-spacing:.04em}
@media(max-width:760px){.tagrow{grid-template-columns:1fr 1fr}.taghead{display:none}}
</style>`;
  return c.html(renderLayout({ title: '标签', user: c.get('user'), active: '/admin/tags', body }));
});

tags.post('/tags/create', async (c) => {
  const b = await c.req.parseBody();
  const key = String(b.key || '').trim();
  const label = String(b.label || '').trim();
  if (!key || !label) return c.text('key 和显示名必填', 400);
  db.prepare('INSERT OR REPLACE INTO tags (key, label, color) VALUES (?,?,?)').run(key, label, String(b.color || '').trim());
  return c.redirect('/admin/tags');
});
tags.post('/tags/update', async (c) => {
  const b = await c.req.parseBody();
  db.prepare('UPDATE tags SET label=?, color=? WHERE key=?').run(String(b.label || ''), String(b.color || ''), String(b.key));
  return c.redirect('/admin/tags');
});
tags.post('/tags/delete', async (c) => {
  const b = await c.req.parseBody();
  db.prepare('DELETE FROM tags WHERE key=?').run(String(b.key));
  return c.redirect('/admin/tags');
});
tags.post('/tags/quick', async (c) => {
  const b = await c.req.parseBody();
  const key = String(b.key || '').trim();
  if (key) db.prepare('INSERT OR REPLACE INTO tags (key, label) VALUES (?,?)').run(key, key);
  return c.redirect('/admin/tags');
});
