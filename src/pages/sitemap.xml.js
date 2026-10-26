// 动态 sitemap（SSR：随 posts 实时；替代原 @astrojs/sitemap 构建期快照）
import { listNotes, listProjects } from '../lib/posts';
import { SITE } from '../config';

export async function GET(context) {
  // ★ 绝对域名（2026-10-26 第二次审查 P1-C）：原来写 ${SITE.url}，而 SITE 里没有 url 字段
  //   → 每条 <loc> 输出 "undefined/notes/"，整份站点地图对爬虫无效。
  //   以 astro.config.mjs 的 site（= context.site）为唯一真源，SITE.url 仅作兜底。
  const base = String(context.site || SITE.url || '').replace(/\/$/, '');
  const urls = ['/', '/notes/', '/projects/', '/about/', '/search/'];
  for (const n of listNotes()) urls.push(`/notes/${n.id}/`);
  for (const p of listProjects()) urls.push(`/projects/${p.id}/`);
  for (const cat of new Set(listNotes().map((n) => n.id.split('/')[0]).filter(Boolean))) {
    urls.push(`/notes/topic/${cat}/`);
  }
  // 注：/notes/series/* 是 meta-refresh 跳转壳（专栏已归入专题），不列入——跳板页进
  //   站点地图只会给爬虫重复条目
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${encodeURI(base + u)}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml' } });
}
