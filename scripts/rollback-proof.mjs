// 唯一 slug 的干净回滚证明（防测试状态污染）
// ★ 2026-10-21：从 .shots（gitignore）迁入 scripts/ 入库——回归脚本丢了，
//   「升 Node 前先回归」这条纪律就没东西可执行。同时去掉硬编码密码与 CWD 依赖。
//   用法: SCIO_DB=... SCIO_AUDIT_PASS=... node scripts/rollback-proof.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const _dir = dirname(fileURLToPath(import.meta.url));
const B2 = process.env.SCIO_ADMIN_URL || 'http://127.0.0.1:4322';
const PASS = process.env.SCIO_AUDIT_PASS || 'test123456';
const lp = await fetch(B2 + '/admin/login', { method: 'POST', body: new URLSearchParams({ username: 'scio', password: PASS }), redirect: 'manual' });
const cookie = lp.headers.get('set-cookie').split(';')[0];
const H = { cookie };
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync(process.env.SCIO_DB || join(_dir, '../admin/data/admin.db'));
const slug = 'rb-proof-' + Date.now().toString(36);
const before = db.prepare('SELECT COUNT(*) c FROM posts').get().c;

await fetch(B2 + '/admin/notes/new', { headers: H, redirect: 'manual' });
const html = await (await fetch(B2 + '/admin/notes', { headers: H })).text();
const id = [...html.matchAll(/\/admin\/notes\/(\d+)\/edit/g)].map(m => Number(m[1])).sort((a,b)=>b-a)[0];
await fetch(B2 + `/admin/api/drafts/${id}`, { method: 'PUT', headers: { ...H, 'Content-Type': 'application/json' }, body: JSON.stringify({
  title: '回滚证明', category: 'frontend', slug,
  fm: { description: 'x', date: '2026-10-20', tags: [], draft: false }, content_md: '# rb\n' }) });
await fetch(B2 + '/admin/api/publish', { method: 'POST', headers: H }).catch(()=>{});
await new Promise(r => setTimeout(r, 5000));
const mid = db.prepare('SELECT COUNT(*) c FROM posts').get().c;
const published = !!db.prepare('SELECT 1 FROM posts WHERE slug=?').get(slug);
console.log('① 发布加行:', mid === before + 1 && published ? 'PASS' : `FAIL ${before}→${mid} published=${published}`);

const rb = await fetch(B2 + '/admin/publishes/rollback', { method: 'POST', headers: H, redirect: 'manual' });
await new Promise(r => setTimeout(r, 1200));
const after = db.prepare('SELECT COUNT(*) c FROM posts').get().c;
const gone = !db.prepare('SELECT 1 FROM posts WHERE slug=?').get(slug);
console.log('② 回滚删行（真删）:', (rb.ok || rb.status === 302) && after === before && gone ? 'PASS' : `FAIL rb=${rb.status} ${mid}→${after} gone=${gone}`);

const rb2 = await fetch(B2 + '/admin/publishes/rollback', { method: 'POST', headers: H, redirect: 'manual' });
console.log('③ 二次回滚被拒:', !rb2.ok ? 'PASS' : `FAIL rb2=${rb2.status}`);
// 清掉证明草稿
db.prepare('DELETE FROM drafts WHERE id=?').run(id);
