# scio · 个人站点

> scio — 拉丁语「我知道」，出自 *Scio me nihil scire*（我知道我一无所知）。

个人名片 + 知识库 + 项目复盘，一个纯静态站点：内容全部是 Markdown，构建产物可以部署到任何静态托管平台。

技术栈：[Astro](https://astro.build) · TypeScript · [Pagefind](https://pagefind.app)（静态搜索）· 原生 CSS，无 UI 框架依赖。

## 快速开始

```bash
npm install
npm run dev        # 本地开发，http://localhost:4321
npm run build      # 构建（含搜索索引），输出到 dist/
npm run preview    # 本地预览构建结果（搜索在这里可用）
```

> 搜索索引是在构建时生成的，所以 `npm run dev` 下搜索页会提示先执行构建。

## 变成你自己的站点（三步）

1. **改个人信息**：`src/config.ts` —— 名字、一句话介绍、技能标签、社交链接
2. **换头像**：替换 `public/avatar.svg`（想用 png 就改名 `avatar.png`，并同步修改 `src/pages/index.astro` 里的引用）
3. **改域名**：`astro.config.mjs` 里的 `site` 换成你的正式域名（影响 sitemap 和 RSS 链接）

## 写一篇知识笔记

在 `src/content/notes/<分类>/` 下新建 `xxx.md`，**文件夹名就是分类名**：

```md
---
title: 笔记标题
description: 一句话描述（列表页展示用）
date: 2026-09-12
tags: [标签1, 标签2]
---
正文，标准 Markdown。
```

- 想加新分类？直接新建一个文件夹
- `draft: true` 表示草稿，构建时会被隐藏
- 知识库侧边栏目录根据文件夹结构自动生成

## 写一份项目复盘

在 `src/content/projects/` 下新建 `xxx.md`：

```md
---
title: 项目名
description: 一句话简介
date: 2026-09-12          # 最后更新时间，用于排序
period: 2026.01 – 2026.09 # 可选，时间段
role: 独立开发             # 可选，你的角色
tech: [Astro, TypeScript] # 技术栈标签
status: 已完成             # 进行中 / 已完成 / 已归档
link: https://...         # 可选，线上地址
repo: https://...         # 可选，仓库地址
---
```

推荐的正文结构：**背景与目标 → 技术选型 → 实现要点 → 踩坑记录 → 经验沉淀**。参考现成的例子：`src/content/projects/个人网站搭建.md`。

## 目录结构

```
src/
├── config.ts            # 全站个人信息，改这里
├── content.config.ts    # 内容集合的 frontmatter schema
├── content/
│   ├── notes/           # 知识库（子文件夹 = 分类）
│   └── projects/        # 项目复盘
├── layouts/Base.astro   # 页面骨架（head / 主题初始化）
├── components/          # Header / Footer / Icon
├── pages/               # 路由：首页、notes、projects、search、rss、404
└── styles/global.css    # 全局样式与深浅色主题变量
```

## 部署

`npm run build` 产出纯静态 `dist/`，任意静态托管均可：

- **Vercel / Netlify**：构建命令 `npm run build`，输出目录 `dist`
- **GitHub Pages**：用官方 Action `withastro/action@v2` 即可；注意 `build` 脚本里包含 pagefind 索引步骤，不要改成裸的 `astro build`
- 部署前把 `astro.config.mjs` 的 `site` 换成正式域名

## 自定义外观

- 星空主题色板：`src/styles/global.css` 顶部的 `:root` 变量
- 页头导航：`src/components/Header.astro`
- 首页版式：`src/pages/index.astro`


