// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // TODO: 部署前换成你自己的域名（影响 sitemap / RSS 里的链接）
  site: 'https://example.com',
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: 'vesper', wrap: true },
  },
});
