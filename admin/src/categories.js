// scio 管理后台 · 分类管理
// 注册表决定每个分类（= 首页星团 / 知识库专题卡 / 专题页 banner）的显示名、一句话描述、
// 域色与形态种子；未注册的分类按文件夹名显示 + 自动配色 + 哈希派生形状。
// 发布时导出 src/data/categories.json，站点构建期读取（与标签注册表同款链路）。
import { Hono } from 'hono';
import { db } from './db.js';
import { renderLayout } from './views.js';

export const categories = new Hono();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

// 分类 key 归一：一律小写（与 posts.category 的写入侧归一保持一致，防止 AI/ai 长成两个星团）
const normKey = (s) => String(s ?? '').trim().toLowerCase().replace(/[^\w一-龥-]/g, '');

// 库里真实存在的分类 + 文章数（含草稿里出现但还没发布的）
function discoveredCats() {
  const used = new Map();
  for (const r of db.prepare('SELECT category, COUNT(*) n FROM posts WHERE kind=\'note\' GROUP BY category').all()) {
    if (r.category) used.set(r.category.toLowerCase(), (used.get(r.category.toLowerCase()) || 0) + r.n);
  }
  for (const r of db.prepare("SELECT category, COUNT(*) n FROM drafts WHERE kind='note' AND category != '' GROUP BY category").all()) {
    const k = r.category.toLowerCase();
    if (!used.has(k)) used.set(k, 0); // 草稿里的新分类：还没发布也要能在后台先配好元信息
  }
  return used;
}

export function registryJson() {
  const rows = db.prepare('SELECT key, label, desc, color, shape FROM categories').all();
  return Object.fromEntries(
    rows.map((r) => [
      r.key,
      {
        ...(r.label ? { label: r.label } : {}),
        ...(r.desc ? { desc: r.desc } : {}),
        ...(r.color ? { color: r.color } : {}),
        ...(r.shape ? { shape: r.shape } : {}),
      },
    ]),
  );
}

categories.get('/categories', (c) => {
  const reg = db.prepare('SELECT * FROM categories ORDER BY key').all();
  const regKeys = new Set(reg.map((r) => r.key));
  const used = discoveredCats();
  const unregistered = [...used.entries()].filter(([k]) => !regKeys.has(k));
  const body = `
<h2>分类</h2>
<p class="hint" style="margin-bottom:14px">
  每个分类 = 首页一个星团 = 知识库一张专题卡。显示名与描述留空则按文件夹名显示、无描述；
  域色留空则自动配色（按建团先后排队取色，老团永不换色）；形态种子留空则由分类名哈希自动生成。
  <b>发布时同步到站点</b>（导出 categories.json，需重建生效）。
</p>
${unregistered.length ? `<div class="card" style="margin-bottom:14px;border-color:var(--ac)">
<div style="font-weight:600;margin-bottom:10px">发现 ${unregistered.length} 个未注册分类（文章或草稿里在用）</div>
<div class="row">${unregistered.map(([k, n]) => `<form method="post" action="/admin/categories/quick">
<input type="hidden" name="key" value="${esc(k)}">
<button class="btn ghost sm" type="submit" title="登记后可填中文名与描述">${esc(k)} · ${n} 篇 +</button></form>`).join('')}</div></div>` : ''}
<div class="card flush">
  <div class="crow chead"><span>key</span><span>显示名</span><span>一句话描述</span><span>域色</span><span>形态种子</span><span></span></div>
  ${reg.map((r) => `
  <form method="post" action="/admin/categories/update" class="crow">
    <span><code>${esc(r.key)}</code><input type="hidden" name="key" value="${esc(r.key)}"></span>
    <span><input name="label" value="${esc(r.label)}" placeholder="${esc(r.key)}" aria-label="显示名"></span>
    <span><input name="desc" value="${esc(r.desc)}" placeholder="如：框架 · 工程化 · 浏览器" aria-label="描述"></span>
    <span><input name="color" value="${esc(r.color)}" placeholder="自动" aria-label="域色"></span>
    <span><input name="shape" value="${esc(r.shape)}" placeholder="自动" aria-label="形态种子"></span>
    <span class="row" style="gap:6px;justify-content:flex-end">
      <button class="btn ghost sm" type="submit">存</button>
      <button class="btn ghost sm danger" type="submit" formaction="/admin/categories/delete"
        onclick="return confirm('撤销 ${esc(r.key)} 的注册？文章不受影响，之后回到自动配色与自动形态')">删</button>
    </span>
  </form>`).join('') || '<div class="empty">还没有注册任何分类——不注册也能正常显示，注册是为了中文名与描述</div>'}
</div>
<div class="card" style="margin-top:16px"><div style="font-weight:600;margin-bottom:10px">注册新分类</div>
<form method="post" action="/admin/categories/create" class="row" style="gap:10px">
<input name="key" placeholder="key（= 文件夹名，自动转小写）" required style="flex:1;min-width:150px">
<input name="label" placeholder="显示名" style="flex:1;min-width:120px">
<input name="desc" placeholder="一句话描述" style="flex:2;min-width:180px">
<button class="btn" type="submit">添加</button></form></div>
<div class="hint" style="margin-top:12px">⚠️ 手填域色会立刻改变首页星团、知识库卡与专题页三处颜色，并占用色板一档
  （自动色板共 20 档）。不确定就留空走自动配色。</div>
<style>
.crow{display:grid;grid-template-columns:.9fr 1fr 1.6fr .8fr .8fr auto;gap:10px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--bd)}
.crow:last-child{border-bottom:0}
.crow input{padding:7px 10px}
.chead{color:var(--muted);font-size:12.5px;letter-spacing:.04em}
@media(max-width:900px){.crow{grid-template-columns:1fr 1fr}.chead{display:none}}
</style>`;
  return c.html(renderLayout({ title: '分类', user: c.get('user'), active: '/admin/categories', body }));
});

categories.post('/categories/create', async (c) => {
  const b = await c.req.parseBody();
  const key = normKey(b.key);
  if (!key) return c.text('key 必填', 400);
  db.prepare('INSERT OR REPLACE INTO categories (key, label, desc, color, shape) VALUES (?,?,?,?,?)')
    .run(key, String(b.label || '').trim(), String(b.desc || '').trim(), String(b.color || '').trim(), String(b.shape || '').trim());
  return c.redirect('/admin/categories');
});

categories.post('/categories/update', async (c) => {
  const b = await c.req.parseBody();
  const key = normKey(b.key);
  // 逐字段覆盖：留空 = 不写这一字段 → 站点回落到代码默认值（如 frontend 的中文名/描述），
  // 避免「在后台点一次保存」把 config.ts 里已有的默认值抹掉
  db.prepare(`UPDATE categories SET
      label = CASE WHEN ? = '' THEN label ELSE ? END,
      desc  = CASE WHEN ? = '' THEN desc  ELSE ? END,
      color = CASE WHEN ? = '' THEN color ELSE ? END,
      shape = CASE WHEN ? = '' THEN shape ELSE ? END
    WHERE key = ?`)
    .run(
      String(b.label || '').trim(), String(b.label || '').trim(),
      String(b.desc || '').trim(), String(b.desc || '').trim(),
      String(b.color || '').trim(), String(b.color || '').trim(),
      String(b.shape || '').trim(), String(b.shape || '').trim(),
      key,
    );
  return c.redirect('/admin/categories');
});

categories.post('/categories/delete', async (c) => {
  const b = await c.req.parseBody();
  db.prepare('DELETE FROM categories WHERE key=?').run(normKey(b.key));
  return c.redirect('/admin/categories');
});

// 一键登记（用文件夹名做初始 key，之后可补中文名）
categories.post('/categories/quick', async (c) => {
  const b = await c.req.parseBody();
  const key = normKey(b.key);
  if (key) db.prepare('INSERT OR IGNORE INTO categories (key) VALUES (?)').run(key);
  return c.redirect('/admin/categories');
});
