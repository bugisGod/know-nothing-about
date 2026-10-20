// 唯一 slug 的干净回滚证明（防测试状态污染）
const B2 = 'http://127.0.0.1:4322';
const lp = await fetch(B2 + '/admin/login', { method: 'POST', body: new URLSearchParams({ username: 'scio', password: 'test123456' }), redirect: 'manual' });
const cookie = lp.headers.get('set-cookie').split(';')[0];
const H = { cookie };
const { DatabaseSync } = await import('node:sqlite');
const db = new DatabaseSync('admin/data/admin.db');
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
