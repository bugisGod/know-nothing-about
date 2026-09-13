import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../config';

export async function GET(context) {
  const notes = (await getCollection('notes', ({ data }) => !data.draft)).filter((e) => e.data.date);
  const projects = (await getCollection('projects', ({ data }) => !data.draft)).filter(
    (e) => e.data.date
  );

  const items = [
    ...notes.map((e) => ({
      title: `[笔记] ${e.data.title}`,
      description: e.data.description ?? '',
      link: `/notes/${e.id}/`,
      pubDate: e.data.date,
    })),
    ...projects.map((e) => ({
      title: `[项目] ${e.data.title}`,
      description: e.data.description,
      link: `/projects/${e.id}/`,
      pubDate: e.data.date,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  return rss({
    title: SITE.title,
    description: SITE.tagline,
    site: context.site,
    items,
    customData: '<language>zh-CN</language>',
  });
}
