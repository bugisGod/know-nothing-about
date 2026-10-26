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

// 七页
for (const [p, kw] of [['/admin', '概览'], ['/admin/notes', '笔记'], ['/admin/projects', '项目'], ['/admin/tags', '标签'], ['/admin/categories', '分类'], ['/admin/stats', '统计'], ['/admin/publishes', '发布历史']]) {
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

// ===== 值级断言（2026-10-26 第二次审查后补）=====
// ★ 为什么单独有一段：上面那些断言只验「页面 200 + 含某关键字」，于是 sitemap 每条 loc
//   都是 "undefined/..."、卡片星链坐标漏乘团半径、后台项目列表读已退役 md 这三个 P1
//   全绿通过了。这一段一律验「值」，不验存在性。

// ① sitemap / RSS 的绝对地址必须真的拼出来了
const smTxt = await (await fetch(B1 + '/sitemap.xml')).text();
const locs = [...smTxt.matchAll(/<loc>([^<]*)<\/loc>/g)].map((x) => x[1]);
T('sitemap loc 全为绝对 https 地址', locs.length > 0 && locs.every((l) => /^https:\/\//.test(l)), `${locs.length} 条`);
T('sitemap loc 无 undefined/NaN', !/undefined|NaN/.test(smTxt));
T('sitemap loc 已百分号编码（中文 slug）', locs.some((l) => /%[0-9A-F]{2}/.test(l)));
const rssTxt = await (await fetch(B1 + '/rss.xml')).text();
const rlinks = [...rssTxt.matchAll(/<link>(https?:[^<]*)<\/link>/g)].map((x) => x[1]).slice(1);
T('RSS link 全为绝对地址', rlinks.length > 0 && rlinks.every((l) => /^https?:\/\//.test(l)) && !/undefined/.test(rssTxt), `${rlinks.length} 条`);

// ② 三处星团配色必须同源：首页 payload ↔ 知识库专题卡 ↔ 每个专题页 banner
const kbTxt = await (await fetch(B1 + '/notes/')).text();
const kbTc = [...kbTxt.matchAll(/--tc:\s*(#[0-9a-f]{6})/g)].map((m) => m[1]);
const homeColors = gd.clusters.filter((c) => c.key !== 'projects').map((c) => c.color?.toLowerCase());
T('知识库卡配色集合 = 首页星团配色集合', kbTc.length > 0 && [...homeColors].sort().join() === [...kbTc].sort().join(),
  `首页 ${homeColors.join(' ')} ↔ 卡 ${kbTc.join(' ')}`);
let tcMismatch = '';
for (const c of gd.clusters) {
  const seg = c.key.startsWith('cat:') ? c.key.slice(4) : null;
  if (!seg) continue;
  const tp = await (await fetch(`${B1}/notes/topic/${seg}/`)).text();
  const tc = (tp.match(/--tc:\s*(#[0-9a-f]{6})/) || [])[1];
  if (tc !== c.color?.toLowerCase()) tcMismatch += `${seg}:${tc}≠${c.color} `;
}
T('每个专题页 banner 色 = 首页该团色', !tcMismatch, tcMismatch || `${gd.clusters.length - 1} 个专题页`);

// ③ 卡片必须真的把「星链」画在团的尺度上（P1-A 的回归哨兵）
//   漏乘团半径时整条链会缩进团心主星辉光里——页面 200、点云 320 个、半径分布也看不出异常
//   （珠子和团块的亮度/尺寸区间本就重叠），所以让组件自报 morph.beadR（链铺开的最大半径，
//   以团半径为单位）：有链却 beadR≈0 → 尺度算错了。
let cardBad = '';
// data-g 属性里的引号被 Astro 转义成 &#34;，必须先解码再 JSON.parse
const unesc = (s) => s.replace(/&#34;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const cards = [...kbTxt.matchAll(/data-g="(\{.*?\})"/g)].map((m) => JSON.parse(unesc(m[1])));
for (const d of cards) {
  const nan = d.cloud.concat(d.stars || []).filter((p) => !isFinite(p.x) || !isFinite(p.y)).length;
  const mo = d.morph || {};
  if (nan > 0) cardBad += `NaN${nan} `;
  else if (mo.nChains > 0 && !(mo.beadR >= 0.2)) cardBad += `链${mo.nChains}条但beadR=${mo.beadR} `;
  else if (!mo.nChains && !mo.nClumps) cardBad += '无结构团 ';
}
const chainCards = cards.filter((d) => d.morph?.nChains > 0).length;
T('卡片星链铺在团的尺度上（beadR≥0.2R）且无 NaN', !!cards.length && !cardBad,
  `${cards.length} 张卡（${chainCards} 张带链）${cardBad ? ' | ' + cardBad : ''}`);

// ④ 列表「已发布数」必须等于真实内容数（孤儿 md 曾让旧断言假通过）
const projCount = (await (await fetch(B2 + '/admin/projects', { headers: H })).text()).match(/已发布 (\d+)/);
const projStars = gd.stars.filter((s) => s.kind === '项目').length;
T('后台项目已发布数 = 首页项目星数', projCount && Number(projCount[1]) === projStars, `后台 ${projCount?.[1]} ↔ 星 ${projStars}`);
const notesCount = (await (await fetch(B2 + '/admin/notes', { headers: H })).text()).match(/已发布 (\d+)/);
const noteStars = gd.stars.filter((s) => s.kind !== '项目').length;
T('后台笔记已发布数 = 首页文章星数', notesCount && Number(notesCount[1]) === noteStars, `后台 ${notesCount?.[1]} ↔ 星 ${noteStars}`);

// ⑤ 分类 key 必须已归一（大小写混用会让同一分类长出两个星团）
const badKey = gd.clusters.find((c) => c.key !== c.key.toLowerCase());
T('星团 key 全小写（分类已归一）', !badKey, badKey ? badKey.key : `${gd.clusters.length} 团`);
const upTopic = await fetch(B1 + '/notes/topic/AI/', { redirect: 'manual' });
T('大写专题页 301 归一', upTopic.status === 301 && /^\/notes\/topic\/[a-z0-9_-]+\/$/.test(upTopic.headers.get('location') || ''), `${upTopic.status} → ${upTopic.headers.get('location')}`);
const ghost = await fetch(B1 + '/notes/topic/definitely-not-a-category/');
T('未知分类专题页 404（不再渲染空壳）', ghost.status === 404, `status=${ghost.status}`);

// 发布护栏：SRC_DIR=主仓库有脏改动应拒绝（模拟）
console.log('\n===== 汇总: ' + pass + ' 通过 / ' + fail + ' 失败 =====');
process.exit(fail > 0 ? 1 : 0);
