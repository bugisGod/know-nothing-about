// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // 正式站点地址（影响 RSS 里的链接）
  site: 'https://nihilscire.com',
  // ★ SSR 模式（2026-10-18 用户定稿「彻底动态版」）：文章存 SQLite、页面实时渲染、
  //   发布即时生效。sitemap 由 src/pages/sitemap.xml.ts 动态生成（原集成只在构建期出快照）
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  markdown: {
    shikiConfig: { theme: 'vesper', wrap: true },
  },
});
