// scio 管理后台 · 服务端渲染视图（无前端框架）
// ★ 视觉与站点同源：令牌直接照抄 src/styles/global.css 的「星空」主题
//   （近黑底 / 发丝边线 / 暖白字 / 琥珀点缀 / 衬线标题），不另起一套配色。
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
export { esc };

const CSS = `
:root{
  color-scheme: dark;
  /* ── 与站点 global.css 一一对应 ── */
  --bg:#060709;
  --bg-inset:#0d0f13;
  --card:#0e1014;
  --tx:#e8e6df;
  --tx2:#a7a9b8;
  --muted:#8992a6;
  --bd:#222b3a;
  --bd-strong:#3a3d55;
  --ac:#d9b879;            /* 站点琥珀 */
  --ok:#7fbf9a;
  --er:#d98a8a;
  --radius:10px;
  --font-display:"Instrument Serif","Noto Serif SC","Songti SC",Georgia,serif;
  --font-sans:"Inter Variable",-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC",sans-serif;
  --mono:ui-monospace,"Cascadia Code",Consolas,"JetBrains Mono",monospace;
  /* 兼容旧写法（历史内联样式里用过） */
  --bg2:var(--card);
  --ac2:var(--ac);
}
*{box-sizing:border-box;margin:0}
html{background:var(--bg)}
body{
  background:var(--bg);
  background-image:radial-gradient(1100px 520px at 82% -8%, rgba(217,184,121,.055), transparent 60%);
  background-attachment:fixed;
  color:var(--tx);
  font-family:var(--font-sans);
  font-size:15px;
  line-height:1.8;
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
}
a{color:inherit;text-decoration:none}
::selection{background:rgba(217,184,121,.26)}

/* ── 骨架 ── */
.wrap{max-width:1080px;margin:0 auto;padding:22px 20px 72px}
.top{display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 0;border-bottom:1px solid var(--bd);margin-bottom:24px}
.brand{font-family:var(--font-display);font-size:20px;font-weight:600;letter-spacing:.02em;line-height:1.4}
.brand .dot{color:var(--ac)}                    /* 站点标识：琥珀句点 */
.brand small{font-family:var(--font-sans);font-size:12.5px;color:var(--muted);font-weight:400;margin-left:9px;letter-spacing:.08em}
.nav{display:flex;gap:2px;margin-right:6px;flex-wrap:wrap}
.nav a{color:var(--tx2);padding:6px 11px;border-radius:8px;font-size:14px;transition:color .15s,background .15s}
.nav a:hover{color:var(--tx);background:var(--bg-inset)}
.nav a.on{color:var(--tx);background:var(--bg-inset);box-shadow:inset 0 0 0 1px var(--bd)}
.who{font-size:13px;color:var(--muted)}

/* ── 标题／文本 ── */
h1,h2,h3{font-family:var(--font-display);font-weight:600;line-height:1.35}
h2{font-size:19px;margin-bottom:14px}
h3{font-size:16px;margin-bottom:10px}
.muted{color:var(--muted);font-size:13px}
.hint{color:var(--muted);font-size:13px;line-height:1.7}

/* ── 卡片／栅格 ── */
.card{background:var(--card);border:1px solid var(--bd);border-radius:var(--radius);padding:18px}
.card.flush{padding:0;overflow:hidden}
.grid{display:grid;gap:14px}
.g3{grid-template-columns:repeat(auto-fill,minmax(220px,1fr))}
.g2{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.stat .n{font-family:var(--font-display);font-size:30px;line-height:1.2;margin:2px 0 4px}
.stat .k{font-size:12.5px;color:var(--muted);letter-spacing:.04em}

/* ── 按钮 ── */
.btn{display:inline-block;background:var(--ac);color:#0b0d14;border:1px solid var(--ac);
  border-radius:8px;padding:8px 15px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;
  transition:filter .15s,transform .08s;text-align:center}
.btn:hover{filter:brightness(1.08)}
.btn:active{transform:translateY(1px)}
.btn:disabled{opacity:.5;cursor:default}
.btn.ghost{background:transparent;color:var(--tx2);border-color:var(--bd-strong)}
.btn.ghost:hover{color:var(--tx);border-color:var(--ac)}
.btn.sm{padding:5px 11px;font-size:13px}
.btn.danger{color:var(--er);border-color:var(--bd)}
.btn.danger:hover{color:var(--er);border-color:var(--er)}
button.btn{font-family:inherit}

/* ── 表单 ── */
label{display:block;font-size:12.5px;color:var(--muted);margin:12px 0 5px;letter-spacing:.03em}
input,textarea,select{width:100%;background:var(--bg-inset);color:var(--tx);
  border:1px solid var(--bd);border-radius:8px;padding:9px 12px;font-size:14px;font-family:inherit;line-height:1.6}
input::placeholder,textarea::placeholder{color:#5d6478}
input:focus,textarea:focus,select:focus{outline:none;border-color:var(--ac);box-shadow:0 0 0 3px rgba(217,184,121,.10)}
textarea{resize:vertical}
input[type=checkbox]{width:auto;margin-right:7px;accent-color:var(--ac)}
.check{display:flex;align-items:center;margin:0;font-size:13px;color:var(--tx2)}
.fields{display:grid;gap:12px}
.f3{grid-template-columns:2fr 1fr 1fr}
.f3e{grid-template-columns:1fr 1fr 1fr}
@media(max-width:760px){.f3,.f3e{grid-template-columns:1fr}}

/* ── 表格 ── */
.tbl{width:100%;border-collapse:collapse;font-size:14px}
.tbl th{color:var(--tx2);font-weight:500;font-size:12.5px;letter-spacing:.04em;
  text-align:left;padding:11px 14px;border-bottom:1px solid var(--bd)}
.tbl td{padding:10px 14px;border-bottom:1px solid var(--bd);vertical-align:middle}
.tbl tr:last-child td{border-bottom:0}
.tbl td.num,.tbl th.num{text-align:right;font-variant-numeric:tabular-nums}
.bar{height:8px;border-radius:99px;background:linear-gradient(90deg,rgba(217,184,121,.85),rgba(217,184,121,.35));min-width:2px}

/* ── 列表行（笔记/项目共用）── */
.nrow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--bd)}
.nrow:last-child{border-bottom:0}
.nrow:hover{background:rgba(255,255,255,.015)}
.nrow-main{min-width:0}
.nrow-title{font-weight:600;color:var(--tx);display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.nrow-title:hover{color:var(--ac)}
.nrow-sub{font-size:12.5px;margin-top:2px;color:var(--muted)}
.nrow-side{display:flex;align-items:center;gap:8px;flex:none}
.chip{font-size:12px;padding:2px 10px;border-radius:99px;border:1px solid var(--bd);color:var(--tx2);white-space:nowrap}
.chip.published{color:var(--ok);border-color:rgba(127,191,154,.32)}
.chip.draft{color:var(--ac);border-color:rgba(217,184,121,.32)}
.iconbtn{background:none;border:0;color:var(--muted);cursor:pointer;font-size:14px;padding:3px 8px;border-radius:6px;line-height:1.5}
.iconbtn:hover{color:var(--er);background:var(--bg-inset)}
.empty{padding:34px 16px;text-align:center;color:var(--muted);font-size:13.5px}

/* ── 编辑器 ── */
.ed-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start}
.ed-body{min-height:56vh;font-family:var(--mono);font-size:13.5px;line-height:1.8}
.ed-preview{min-height:56vh;display:none;overflow:auto}
.ed-preview img{max-width:100%;border-radius:8px}
.ed-preview h1,.ed-preview h2{font-family:var(--font-display);border-bottom:1px solid var(--bd);padding-bottom:6px;margin:14px 0 10px}
.ed-preview code{background:var(--bg-inset);padding:2px 6px;border-radius:4px;font-size:13px;font-family:var(--mono)}
.ed-preview pre{background:var(--bg-inset);padding:12px;border-radius:8px;overflow:auto;font-family:var(--mono);font-size:13px}
.ed-preview blockquote{border-left:3px solid var(--bd);padding-left:12px;color:var(--tx2);margin:10px 0}
.ed-preview p,.ed-preview li{margin:8px 0}
.ed-preview a{color:var(--ac);text-decoration:underline}
@media(max-width:820px){.ed-grid{grid-template-columns:1fr}.ed-preview{display:none!important}}
.log{white-space:pre-wrap;font-family:var(--mono);font-size:12.5px;max-height:300px;overflow:auto;line-height:1.7}

/* ── 登录 ── */
.login{max-width:352px;margin:14vh auto 0}
.login .brand{font-size:23px;margin-bottom:18px;text-align:center}
.err{color:var(--er);font-size:13px;margin-top:10px;min-height:1em}

/* ── 其他 ── */
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
mark{background:rgba(217,184,121,.18);color:var(--tx);padding:0 3px;border-radius:3px}
code{font-family:var(--mono);font-size:12.5px}
@media(max-width:640px){
  .top{flex-direction:column;align-items:stretch;gap:12px}
  .nav{width:100%;justify-content:space-between}
  .wrap{padding:18px 14px 56px}
}
`;

export function renderLayout({ title, body, user, active }) {
  const NAV = [
    ['/admin', '概览'], ['/admin/notes', '笔记'], ['/admin/projects', '项目'],
    ['/admin/tags', '标签'], ['/admin/stats', '统计'], ['/admin/publishes', '发布'],
  ];
  const nav = NAV.map(([href, label]) =>
    `<a href="${href}"${active === href ? ' class="on"' : ''}>${label}</a>`).join('');
  return `<!doctype html><html lang="zh-CN"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="color-scheme" content="dark">
<title>${esc(title)} · scio</title><style>${CSS}</style></head><body><div class="wrap">
${user ? `<div class="top">
  <div class="brand">scio<span class="dot">.</span><small>管理后台</small></div>
  <div class="row">
    <nav class="nav">${nav}</nav>
    <span class="who">${esc(user.username)}</span>
    <form method="post" action="/admin/logout"><button class="btn ghost sm" type="submit">退出</button></form>
  </div></div>` : ''}
${body}</div></body></html>`;
}

export function renderLogin({ error }) {
  return renderLayout({ title: '登录', user: null, body: `
<div class="card login">
  <div class="brand">scio<span class="dot">.</span></div>
  <form method="post" action="/admin/login">
    <label>用户名</label><input name="username" autocomplete="username" required>
    <label>密码</label><input name="password" type="password" autocomplete="current-password" required>
    <div class="err">${esc(error)}</div>
    <button class="btn" type="submit" style="width:100%;margin-top:8px">进入</button>
  </form>
</div>` });
}

import { db } from './db.js';
import { listRepoNotes } from './repo.js';

const statusBadge = (s) => {
  const map = { ok: ['var(--ok)', '成功'], failed: ['var(--er)', '失败'], rolled_back: ['var(--tx2)', '已回滚'], running: ['var(--tx2)', '进行中'] };
  const [c, t] = map[s] || ['var(--tx2)', s];
  return `<span style="color:${c}">${t}</span>`;
};

export function renderDashboard({ user }) {
  const repo = (() => { try { return listRepoNotes(); } catch { return []; } })();
  const drafts = db.prepare("SELECT COUNT(*) c FROM drafts WHERE kind='note'").get().c;
  const media = db.prepare('SELECT COUNT(*) c FROM media').get().c;
  const lastPub = db.prepare('SELECT status, started_at, finished_at FROM publishes ORDER BY id DESC LIMIT 1').get();
  const recent = db.prepare('SELECT title, category, updated_at, id FROM drafts ORDER BY updated_at DESC LIMIT 5').all();
  return renderLayout({ title: '概览', user, active: '/admin', body: `
<div class="row" style="justify-content:space-between;margin-bottom:16px">
  <h2 style="margin:0">概览</h2>
  <a class="btn" href="/admin/notes/new">✎ 写新笔记</a>
</div>
<div class="grid g3">
  <div class="card stat"><div class="k">已发布笔记</div><div class="n">${repo.length}</div>
    <div class="muted">${[...new Set(repo.map((r) => r.category))].map(esc).join(' · ') || '—'}</div></div>
  <div class="card stat"><div class="k">草稿</div><div class="n">${drafts}</div>
    <a class="muted" href="/admin/notes">查看 →</a></div>
  <div class="card stat"><div class="k">图片库</div><div class="n">${media}</div>
    <div class="muted">随发布进仓库</div></div>
</div>
<div class="card" style="margin-top:14px"><div class="row" style="justify-content:space-between">
  <div><span class="muted">最近发布：</span>${lastPub ? `${statusBadge(lastPub.status)} <span class="muted">${esc(String(lastPub.finished_at || lastPub.started_at || ''))}</span>` : '<span class="muted">还没发布过</span>'}</div>
  <a class="btn ghost sm" href="/admin/publishes">发布历史</a>
</div></div>
${recent.length ? `<h2 style="margin:26px 0 10px">最近编辑</h2>
<div class="card flush">${recent.map((r) => `<a class="nrow" href="/admin/notes/${r.id}/edit">
  <span class="nrow-main">
    <span class="nrow-title">${esc(r.title || '（无标题草稿）')}</span>
    <span class="nrow-sub">${esc(r.category || '未分类')} · ${esc(String(r.updated_at || '').slice(5, 16))}</span>
  </span></a>`).join('')}</div>` : ''}` });
}

export function renderPublishes({ user, rows }) {
  return renderLayout({ title: '发布历史', user, active: '/admin/publishes', body: `
<div class="row" style="justify-content:space-between;margin-bottom:14px">
  <h2 style="margin:0">发布历史</h2>
  <form method="post" action="/admin/publishes/rollback" onsubmit="return confirm('回滚到上一个版本？')">
    <button class="btn ghost sm" type="submit">↩ 回滚上一版</button></form>
</div>
<div class="card flush">
<table class="tbl">
<thead><tr><th>#</th><th>状态</th><th>commit</th><th>时间</th></tr></thead>
<tbody>${rows.map((p) => `<tr>
<td>${p.id}</td>
<td>${statusBadge(p.status)}</td>
<td><code>${esc(p.commit_sha || '—')}</code></td>
<td class="muted">${esc(String(p.finished_at || p.started_at || ''))}</td></tr>`).join('') || '<tr><td><div class="empty">还没有发布记录</div></td></tr>'}
</tbody></table></div>` });
}
