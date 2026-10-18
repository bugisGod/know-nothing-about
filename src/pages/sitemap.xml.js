// 动态 sitemap（SSR：随 posts 实时；替代原 @astrojs/sitemap 构建期快照）
import { listNotes, listProjects } from '../lib/posts';
import { SITE } from '../config';

export async function GET() {
  const urls = ['/', '/notes/', '/projects/', '/about/', '/search/'];
  for (const n of listNotes()) urls.push(`/notes/${n.id}/`);
  for (const p of listProjects()) urls.push(`/projects/${p.id}/`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE.url}${u}</loc></url>`).join('\n')}
</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml' } });
}
