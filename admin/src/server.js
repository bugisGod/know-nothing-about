// scio 管理后台 · HTTP 服务（Hono）
// 路由前缀 /admin：登录页、会话、仪表盘骨架。P2 起加笔记/发布等。
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { DATA_DIR } from './db.js';
import { SRC_DIR } from './repo.js';
import {
  db, createSession, getSessionUser, cleanSessions,
  loginThrottled, recordLoginFail, clearLoginFails,
} from './db.js';
import { renderLayout, renderLogin, renderDashboard } from './views.js';

const PORT = Number(process.env.SCIO_ADMIN_PORT || 4322);
const COOKIE = 'scio_admin';

// 首次启动：无用户时从环境变量初始化（SCIO_ADMIN_USER / SCIO_ADMIN_PASS）
function ensureUser() {
  const n = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (n === 0) {
    const u = process.env.SCIO_ADMIN_USER || 'scio';
    const p = process.env.SCIO_ADMIN_PASS;
    if (!p) {
      console.error('[admin] 首次启动需要 SCIO_ADMIN_PASS 环境变量设置初始密码');
      process.exit(1);
    }
    db.prepare('INSERT INTO users (username, password_hash) VALUES (?,?)').run(u, bcrypt.hashSync(p, 10));
    console.log(`[admin] 已创建管理员: ${u}`);
  }
}
ensureUser();
setInterval(cleanSessions, 3600_000).unref();

const app = new Hono();

// 静态资源（极少量：样式 + 少量 js）
// 静态资源（admin/public/assets/*）——手写处理器，serveStatic 的路径映射不可控已弃
import { ADMIN_HOME } from './db.js';
import { join as _join } from 'node:path';
import { readFileSync } from 'node:fs';
const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
app.get('/admin/assets/:file', (c) => {
  const file = c.req.param('file').replace(/[^\w.-]/g, '');
  try {
    const buf = readFileSync(_join(ADMIN_HOME, 'public', 'assets', file));
    const ext = file.slice(file.lastIndexOf('.'));
    return c.body(buf, 200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'public, max-age=3600' });
  } catch { return c.text('not found', 404); }
});

function auth(c) {
  const token = getCookie(c, COOKIE);
  return getSessionUser(token);
}

app.get('/admin/login', (c) => {
  if (auth(c)) return c.redirect('/admin');
  return c.html(renderLogin({ error: '' }));
});

// ★ 取真实客户端 IP：自己在反向代理（Caddy）后面时，代理会把真实 IP 追加到 XFF 链尾；
//   取链首（旧写法）= 信任客户端伪造的第一跳 → 限速可被绕过。
const clientIp = (c) => {
  const xff = c.req.header('x-forwarded-for');
  if (!xff) return 'local';
  const last = xff.split(',').pop()?.trim();
  return last || 'local';
};

app.post('/admin/login', async (c) => {
  const ip = clientIp(c);
  if (loginThrottled(ip)) {
    return c.html(renderLogin({ error: '尝试过多，请 1 分钟后再试' }), 429);
  }
  const body = await c.req.parseBody();
  const username = String(body.username || '');
  const password = String(body.password || '');
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    recordLoginFail(ip);
    return c.html(renderLogin({ error: '用户名或密码不对' }), 401);
  }
  clearLoginFails(ip);
  const { token, expires } = createSession(user.id);
  // ★ secure 只在 https 下加（本地 http 调试/内网 http 直连时，secure cookie 会被浏览器丢弃 →
  //   表现为「登录成功但一刷新又回登录页」）。按请求协议判断，不由写死的 true 决定。
  const isHttps = (c.req.header('x-forwarded-proto') || new URL(c.req.url).protocol) === 'https:';
  setCookie(c, COOKIE, token, {
    path: '/admin', httpOnly: true, secure: isHttps, sameSite: 'Lax',
    expires: new Date(expires),
  });
  return c.redirect('/admin');
});

app.get('/admin/health', (c) => c.json({ ok: true }));

// 访问统计接收端点（公开、无 cookie、1x1 gif）
app.get('/aa', (c) => {
  const q = c.req.query();
  const sid = crypto.createHash('sha256')
    .update((c.req.header('x-forwarded-for') || '') + '|' + (c.req.header('user-agent') || '') + '|' + new Date().toISOString().slice(0, 10))
    .digest('hex').slice(0, 16);
  db.prepare('INSERT INTO analytics (path, ref, sid, ua) VALUES (?,?,?,?)')
    .run(String(q.p || '/').slice(0, 300), String(q.r || '').slice(0, 300), sid, (c.req.header('user-agent') || '').slice(0, 180));
  // 1x1 透明 gif
  const gif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  return c.body(gif, 200, { 'content-type': 'image/gif', 'cache-control': 'no-store' });
});  // 探活：不鉴权（在下面的中间件之前）

app.use('/admin/*', async (c, next) => {
  const user = auth(c);
  if (!user) {
    // ★ API 路径返回 401 JSON（fetch 客户端需要状态码判断，302 跳登录页会让
    //   编辑器在会话过期时拿到 HTML 报「保存失败」）；页面路径才跳登录
    if (c.req.path.startsWith('/admin/api/')) return c.json({ ok: false, error: '未登录' }, 401);
    return c.redirect('/admin/login');
  }
  c.set('user', user);
  await next();
});

app.get('/admin', (c) => c.html(renderDashboard({ user: c.get('user') })));

// ===== P2：笔记 / 草稿 API / 媒体 / 发布 =====
import { notes, buildFrontmatter } from './notes.js';
app.route('/admin', notes);
import { tags as tagsR } from './tags.js';
app.route('/admin', tagsR);
import { categories as catR } from './categories.js';
app.route('/admin', catR);
import { projects } from './projects.js';
app.route('/admin', projects);
const api = new Hono();
api.use('*', async (c, next) => { const u = auth(c); if (!u) return c.json({ ok: false, error: '未登录' }, 401); await next(); });

api.put('/drafts/:id', async (c) => {
  const d = db.prepare('SELECT * FROM drafts WHERE id=?').get(c.req.param('id'));
  if (!d) return c.json({ ok: false, error: '草稿不存在' }, 404);
  const b = await c.req.json();
  // ★ 分类 key 写入侧归一小写（2026-10-26 审查 P2-1）：草稿的 category 会进 posts 表，
  //   而 UNIQUE(kind,category,slug) 的 category 大小写敏感——AI/ai 各存一行就会长出两个星团
  db.prepare("UPDATE drafts SET title=?, category=?, slug=?, fm=?, content_md=?, updated_at=datetime('now') WHERE id=?")
    .run(String(b.title || '').slice(0, 200), String(b.category || '').replace(/[^\w一-龥-]/g, '').toLowerCase(),
      String(b.slug || '').replace(/[^\w一-龥-]/g, '').toLowerCase(),
      JSON.stringify(b.fm || {}), String(b.content_md || ''), d.id);
  return c.json({ ok: true });
});

api.delete('/drafts/:id', (c) => {
  db.prepare('DELETE FROM drafts WHERE id=?').run(c.req.param('id'));
  return c.json({ ok: true });
});
// 媒体上传：暂存到 admin/data/media，发布时随文进仓库 public/images
import { writeFileSync, mkdirSync } from 'node:fs';
api.post('/media', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!(file instanceof File)) return c.json({ ok: false, error: '没收到文件' }, 400);
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.type)) return c.json({ ok: false, error: '仅支持图片' }, 400);
  if (file.size > 8 * 1024 * 1024) return c.json({ ok: false, error: '最大 8MB' }, 400);
  const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' }[file.type];
  const name = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const dir = join(DATA_DIR, 'media');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), Buffer.from(await file.arrayBuffer()));
  db.prepare('INSERT INTO media (filename, mime, size) VALUES (?,?,?)').run(name, file.type, file.size);
  return c.json({ ok: true, name: file.name, dest: name }); // 正文引用 /images/<name>，发布时由管线搬运
});
app.route('/admin/api', api);

import { publishStream, rollback } from './publish.js';
import { renderPublishes } from './views.js';
app.get('/admin/stats', (c) => {
  const days = db.prepare(`SELECT date(ts) d, COUNT(*) pv, COUNT(DISTINCT sid) uv FROM analytics GROUP BY date(ts) ORDER BY d DESC LIMIT 14`).all();
  const total = db.prepare('SELECT COUNT(*) c FROM analytics').get().c;
  const uv = db.prepare('SELECT COUNT(DISTINCT sid) c FROM analytics').get().c;
  const top = db.prepare(`SELECT path, COUNT(*) c FROM analytics GROUP BY path ORDER BY c DESC LIMIT 10`).all();
  const maxPv = Math.max(...days.map((x) => x.pv), 1);
  const rows = days.map((d) => `<tr>
    <td>${d.d}</td>
    <td class="num">${d.pv}</td>
    <td class="num">${d.uv}</td>
    <td style="width:38%"><div class="bar" style="width:${Math.round((d.pv / maxPv) * 100)}%"></div></td></tr>`).join('');
  const tops = top.map((t) => `<tr><td><code>${esc(t.path)}</code></td><td class="num">${t.c}</td></tr>`).join('');
  return c.html(renderLayout({ title: '统计', user: c.get('user'), active: '/admin/stats', body: `
<h2>访问统计</h2>
<div class="grid g3">
  <div class="card stat"><div class="k">累计 PV</div><div class="n">${total}</div></div>
  <div class="card stat"><div class="k">独立访客（按日哈希）</div><div class="n">${uv}</div></div>
  <div class="card stat"><div class="k">采集方式</div><div class="n" style="font-size:16px;font-family:var(--font-sans);color:var(--tx2)">自托管 1px gif</div>
    <div class="muted">无 cookie · 无第三方</div></div>
</div>
<h2 style="margin:26px 0 10px">近 14 天</h2>
<div class="card flush"><table class="tbl">
<thead><tr><th>日期</th><th class="num">PV</th><th class="num">UV</th><th></th></tr></thead>
<tbody>${rows || '<tr><td><div class="empty">暂无数据（埋点部署后开始采集）</div></td></tr>'}</tbody></table></div>
${tops ? `<h2 style="margin:26px 0 10px">热门页面</h2><div class="card flush"><table class="tbl">
<thead><tr><th>路径</th><th class="num">PV</th></tr></thead><tbody>${tops}</tbody></table></div>` : ''}` }));
});
app.get('/admin/publishes', (c) => {
  const rows = db.prepare('SELECT * FROM publishes ORDER BY id DESC LIMIT 50').all();
  return c.html(renderPublishes({ user: c.get('user'), rows }));
});
app.post('/admin/publishes/rollback', async (c) => {
  let msg = '';
  try { msg = rollback(); }
  catch (e) { return c.text('回滚失败: ' + e.message, 500); }
  // ★ 回滚后搜索索引仍指向已回滚的内容 → 尽力重建（失败不影响回滚结果）
  try {
    execFileSync(process.execPath, [join(SRC_DIR, 'scripts/build-pagefind.mjs'), process.env.SCIO_SITE_URL || 'http://127.0.0.1:4321'],
      { cwd: SRC_DIR, stdio: 'ignore', timeout: 180000 });
  } catch { /* 索引重建失败不阻塞 */ }
  void msg;
  return c.redirect('/admin/publishes?ok=1');
});
app.post('/admin/api/publish', (c) => {
  const ct = c.req.header('content-type') || '';
  void ct;
  return new Response(publishStream(), { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
});
app.post('/admin/logout', (c) => {
  const token = getCookie(c, COOKIE);
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  deleteCookie(c, COOKIE, { path: '/admin' });
  return c.redirect('/admin/login');
});



// ===== 本地整栈演示：静态站伺服（生产由 Caddy 承担；本地把站点/后台/统计收进同一端口）=====
import { WEB_DIR } from './repo.js';
import { existsSync, statSync } from 'node:fs';
const SMIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webp': 'image/webp', '.gif': 'image/gif', '.wasm': 'application/wasm' };
if (WEB_DIR) {
  app.get('*', (c) => {
    let p;
    try { p = decodeURIComponent(new URL(c.req.url, 'http://x').pathname); } catch { return c.text('bad request', 400); }
    if (p.includes('..')) return c.text('bad request', 400);
    let file = join(WEB_DIR, p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      const nf = join(WEB_DIR, '404.html');
      if (existsSync(nf)) return c.html(readFileSync(nf, 'utf8'), 404);
      return c.text('not found', 404);
    }
    return c.body(readFileSync(file), 200, { 'content-type': SMIME[file.slice(file.lastIndexOf('.'))] || 'application/octet-stream' });
  });
}

serve({ fetch: app.fetch, port: PORT, hostname: '127.0.0.1' }, () => {
  console.log(`[admin] listening on 127.0.0.1:${PORT} (prefix /admin)`);
});
