import rss from '@astrojs/rss';
import { listNotes, listProjects } from '../lib/posts';
import { SITE } from '../config';

export async function GET(context) {
  // 全文 RSS：正文渲染成 HTML 放进 content:encoded，订阅器里直接读
  const notes = listNotes().filter((e) => e.data.date);
  const projects = listProjects().filter((e) => e.data.date);

  const items = [];
  for (const e of notes) {
    const html = e.html;
    items.push({
      title: `[笔记] ${e.data.title}`,
      description: e.data.description ?? '',
      content: html,
      link: `/notes/${e.id}/`,
      pubDate: e.data.date,
    });
  }
  for (const e of projects) {
    const html = e.html;
    items.push({
      title: `[项目] ${e.data.title}`,
      description: e.data.description,
      content: html,
      link: `/projects/${e.id}/`,
      pubDate: e.data.date,
    });
  }
  items.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: SITE.title,
    description: SITE.tagline,
    site: context.site,
    items,
    customData: '<language>zh-CN</language>',
  });
}
