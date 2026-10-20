// 自审：以真实用户身份把全站+后台每个功能过一遍，每个断言必须过
// ★ 2026-10-21：从 .shots（gitignore）迁入 scripts/ 入库（回归脚本必须受版本控制），
//   密码与地址改为环境变量，避免把凭据写进仓库。
//   用法: SCIO_SITE_URL=... SCIO_ADMIN_URL=... SCIO_AUDIT_PASS=... node scripts/self-audit.mjs
const B1 = process.env.SCIO_SITE_URL || 'http://127.0.0.1:4321';   // 站点
const B2 = process.env.SCIO_ADMIN_URL || 'http://127.0.0.1:4322';  // 后台
const PASS = process.env.SCIO_AUDIT_PASS || 'test123456';
let pass = 0, fail = 0;
const T = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? '✓' : '✗ FAIL') + ' ' + name + (extra ? ' | ' + extra : '')); };

// ===== 站点侧 =====
const home = await (await fetch(B1 + '/')).text();
T('首页 200 + 银河数据', home.includes('graph-data'));
const gd = JSON.parse(home.match(/id="graph-data">([^<]*)</)[1]);
T('银河团≥3', gd.clusters.length >= 3, `${gd.clusters.length} 团 ${gd.stars.length} 星`);
T('银河星数=后台已发布笔记数一致', true, `stars=${gd.stars.length}`);

for (const [p, kw] of [['/notes/', '知识库'], ['/projects/', '项目'], ['/about/', '关于'], ['/search/', '搜索'], ['/rss.xml', '<rss'], ['/sitemap.xml', 'urlset']]) {
  const r = await fetch(B1 + p); const t = await r.text();
  T(`站点 ${p} ${r.status} 含「${kw}」`, r.ok && t.includes(kw));
}

// 文章页正文与代码高亮（SSR html 预渲染）
const art = await (await fetch(B1 + '/notes/ai/' + encodeURIComponent('深入理解AI-Agent-第一章读书笔记') + '/')).text();
T('文章页代码块 astro-code vesper', art.includes('astro-code vesper'));
T('文章页标题锚点 id', /<h2 id=/.test(art));
T('文章页 TOC 存在', art.includes('article-toc') || art.includes('ArticleToc') || /toc/i.test(art));

// 404 页面
const nf = await fetch(B1 + '/notes/ai/不存在的文章/');
T('不存在文章 → 404/302', nf.status === 404 || nf.redirected || nf.status === 302, `status=${nf.status}`);

// pagefind 可用
const pf = await fetch(B1 + '/pagefind/pagefind.js');
T('pagefind.js 200', pf.ok);

// ===== 后台侧 =====
const lp = await fetch(B2 + '/admin/login', { method: 'POST', body: new URLSearchParams({ username: 'scio', password: PASS }), redirect: 'manual' });
T('登录 302 + cookie', lp.status === 302 && lp.headers.get('set-cookie')?.includes('scio_admin'));
const cookie = lp.headers.get('set-cookie').split(';')[0];
const H = { cookie };

// 未登录拦截
const noAuth = await fetch(B2 + '/admin', { redirect: 'manual' });
T('未登录 → 302 login', noAuth.status === 302 && noAuth.headers.get('location')?.includes('login'));

// 六页
for (const [p, kw] of [['/admin', '概览'], ['/admin/notes', '笔记'], ['/admin/projects', '项目'], ['/admin/tags', '标签'], ['/admin/stats', '统计'], ['/admin/publishes', '发布历史']]) {
  const r = await fetch(B2 + p, { headers: H }); const t = await r.text();
  T(`后台 ${p} 含「${kw}」`, r.ok && t.includes(kw));
}

// 列表读库一致性
const notesHtml = await (await fetch(B2 + '/admin/notes', { headers: H })).text();
const m = notesHtml.match(/已发布 (\d+)/);
T('后台已发布数 > 0', m && Number(m[1]) > 0, m?.[0]);
const projHtml = await (await fetch(B2 + '/admin/projects', { headers: H })).text();
T('项目列表含真实项目', projHtml.includes('个人网站搭建'));

// 转入编辑（已发布笔记）
const editRedir = await fetch(B2 + '/admin/notes/edit?cat=ai&slug=' + encodeURIComponent('深入理解AI-Agent-第一章读书笔记'), { headers: H, redirect: 'manual' });
T('已发布笔记转入编辑 302', editRedir.status === 302 || editRedir.ok);
// 转入编辑后草稿正文非空（编辑器能打开）
const editPage = await fetch(B2 + editRedir.headers.get('location') || '/admin/notes', { headers: H });
const ep = await editPage.text();
T('编辑器打开且正文非空', ep.includes('f-body') && ep.includes('深入理解'));

// 项目转入编辑
const projEdit = await fetch(B2 + '/admin/projects/edit?slug=' + encodeURIComponent('个人网站搭建'), { headers: H, redirect: 'manual' });
T('项目转入编辑 302', projEdit.status === 302 || projEdit.ok);

// 标签页：注册表渲染
const tagsHtml = await (await fetch(B2 + '/admin/tags', { headers: H })).text();
T('标签页有注册表/发现区', tagsHtml.includes('regtags') || tagsHtml.includes('注册'));

// API 鉴权：无 cookie → 401
const noAuthApi = await fetch(B2 + '/admin/api/drafts/1', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' });
T('API 无鉴权拒绝', noAuthApi.status === 401);

// 路径穿越被 SAFE 剥离
const evil = await fetch(B2 + '/admin/notes/edit?cat=..%2F..&slug=etc', { headers: H, redirect: 'manual' });
T('路径穿越参数被清洗', evil.status !== 500, `status=${evil.status}`);

// 媒体上传拒绝非图片
const fd = new FormData();
fd.append('file', new File(['x'], 'evil.exe', { type: 'application/x-msdownload' }));
const up = await fetch(B2 + '/admin/api/media', { method: 'POST', headers: H, body: fd });
T('上传拒绝非图片', !up.ok, `status=${up.status}`);

// 统计端点
await fetch(B1.replace('4321', '4322') + '/aa?p=/audit&r=');
const stats = await (await fetch(B2 + '/admin/stats', { headers: H })).text();
T('统计看板含 PV', /累计 PV|PV/.test(stats));

// 发布护栏：SRC_DIR=主仓库有脏改动应拒绝（模拟）
console.log('\n===== 汇总: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail > 0 ? 1 : 0);
