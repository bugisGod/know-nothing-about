# 项目长期笔记 · know-nothing-about（scio 个人站点）

## 项目概况
- Astro 5 静态站：个人名片 + 知识库（notes）+ 项目复盘（projects）+ Pagefind 静态搜索。
- 纯 Markdown 内容，无 UI 框架，原生 CSS。主题为「星空」深色调（单一主题，无深浅切换）。
- 站点地址 `https://nihilscire.com`；自建服务器 + Caddy（配置在 `.shots/Caddyfile.prod`）。
- 部署：`npm run build`（astro build + pagefind）→ `python deploy.py`（paramiko SFTP 全量上传）。

## 项目约定
- 全站个人信息集中在 `src/config.ts`（SITE / SERIES / CATEGORIES）。
- 内容 schema 在 `src/content.config.ts`（Zod）。分类 = `src/content/notes/` 下的文件夹名。
- 视觉令牌在 `src/styles/global.css` 顶部 `:root`（星空色板，琥珀 `--accent: #d9a920`）。
- 背景星图：12 张 `public/images/deep-sky-*.webp`，按「日期 + 路径哈希」在 `Base.astro` 内联脚本轮换。

## 已知待办（详见仓库根目录 REVIEW.md）
1. 部署凭据改 SSH key + 专用用户（当前 root + 明文密码 + AutoAddPolicy）。
2. build 前清 dist；上传前校验 pagefind / sitemap 产物存在。
3. 分类名与专栏名统一从 config 读取（消灭双写）。
4. `og:image` 绝对化 + canonical。
5. three.js（532 kB）改懒加载 + 窄屏降级静态列表（同时补 a11y 等效列表）。
6. 字体瘦身（407 个子集文件，产物 16 MB）；部署改 rsync / 软链版本切换。

## 环境注意
- 本机 sandbox 有 `safe-delete` 守卫，会中断 Astro 的 `cleanServerOutput`，
  可能导致 sitemap/pagefind 未生成、`dist/pages/` 残留。非项目缺陷，判断构建是否成功时留意。
