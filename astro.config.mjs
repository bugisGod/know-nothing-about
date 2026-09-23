// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // 正式站点地址（影响 sitemap / RSS 里的链接）
  site: 'https://nihilscire.com',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'vesper', wrap: true },
    rehypeHeadingIds: {},
  },
});
