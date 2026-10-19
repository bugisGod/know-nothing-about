# scio · 个人站点

> scio — 拉丁语「我知道」，出自 *Scio me nihil scire*（我知道我一无所知）。

个人名片 + 知识库 + 项目复盘，一个纯静态站点：内容全部是 Markdown，构建产物部署在自家服务器（Caddy）。

技术栈：[Astro](https://astro.build) · TypeScript · [three.js](https://threejs.org)（首页银河）· [Pagefind](https://pagefind.app)（静态搜索）· 原生 CSS，无 UI 框架依赖。

## 快速开始

```bash
npm install
npm run dev        # 本地开发，http://localhost:4321
npm run build      # 构建（含搜索索引），输出到 dist/
npm run preview    # 本地预览构建结果（搜索在这里可用）
```

> 搜索索引在构建时生成，`npm run dev` 下搜索页会提示先执行构建。
> **改代码后必须重启 preview**（sirv 缓存旧 bundle）。

## 日常维护（全部零配置，不改代码）

### 加一篇笔记

`src/content/notes/<分类>/<slug>.md`：

```yaml
---
title: 标题
description: 一句话摘要（列表页/分享卡用）
date: 2026-10-17
tags: [ai, zcode]        # 自由填写
series: 专栏名            # 可选：同 series 在专题页聚成专栏
pinned: true              # 可选：银河里的置顶亮星
related: [其它文章slug]    # 可选：手工知识连线（银河星际航线）
draft: true               # 可选：草稿不构建
---
```

写完发布**即时生效**（写库秒级在线）：首页自动多一颗文章星、星团按 √n 自动长大、知识库自动收录。

### 加一个分类（= 新星团 + 新专题卡）

```
mkdir src/content/notes/<新分类>
```

放文章即生效，三处全自动：首页星团（自动配色 + 独立形状——分类名哈希派生，
与知识库卡同种子同流）、知识库专题卡、`/notes/?category=<分类>` 筛选。
想覆盖默认色/中文名，才在 `src/config.ts` 的 `CATEGORIES` 加条目。

### 加一个项目

`src/content/projects/<slug>.md`，frontmatter 见现有项目
（`period / role / tech / status / link / repo`）。

## 部署

**架构（2026-10-19 SSR 化）**：站点=Node SSR 服务（实时渲染，数据在 SQLite），
后台=独立 Node 服务，Caddy 分流 `/admin`、`/aa` 与其余流量。
内容真身在数据库（admin.db）——**持久化路径 + 备份是生命线**。

```bash
npm run build     # 构建产物 dist/server + dist/client
npm run start     # 本地/服务器：起 SSR + pagefind 索引兜底
```

完整服务器操作手册（systemd 双服务 / Caddy / 数据库迁移 / 备份 / 验证清单）：
**[deploy/DEPLOY.md](deploy/DEPLOY.md)**

- 管理后台：`/admin`（scio-admin 服务，账号密码环境变量初始化）
- 发布=写库即时生效（秒级在线）；发布历史可回滚（posts 快照）
- 部署红线：`git status` 确认无 `*测试*.md`；数据库文件不进 git（.gitignore 已含）


## 首页银河（src/components/BrainGraph.astro）

- 知识专题 = 星团（形状/颜色由分类名哈希自动生成）；文章 = 星；
  探索态（EXPLORE）自由漫游，点星团页内聚焦，点文章星进文章
- 调试口：URL 加 `?debug=1` 暴露 `__gal`——`state()`（逐帧信号采样）、
  `clusterInfo(k)`、`pickTest(x,y)`、`starScreen(i)`
- 视觉改动验收工具（`.shots/`，不入库）：`state-verify.mjs`（聚焦跳变）、
  `fog-matrix.mjs`（雾团矩阵）、`full-test.mjs`（全站 28 项回归）
- 排障铁律：**先枚举点击时所有变化的量、逐帧采值找离散跳变，再改代码**
  （截图法抓不到分支类 bug）

## 目录结构

```
src/
├── config.ts            # 个人信息 + 分类/系列覆盖位 + 自动配色
├── content.config.ts    # 内容集合 frontmatter schema
├── content/
│   ├── notes/           # 知识库（子文件夹 = 分类 = 星团）
│   └── projects/        # 项目复盘
├── layouts/Base.astro   # 页面骨架（head / 主题初始化）
├── components/
│   ├── BrainGraph.astro # 首页 3D 银河（星团/文章星/探索态）
│   ├── MiniGalaxy.astro # 知识库专题卡星图（与首页团同源同形状）
│   └── ...
├── pages/               # 路由：首页、notes、projects、search、404
└── styles/global.css    # 全局样式与主题变量
```

## 其它

- 知识库支持 `?category=分类名` 直接分享分类地址
- 阅读页宽屏右侧目录（ArticleToc），窄屏折叠
- `prefers-reduced-motion` 会关闭星尘动画与流星
- 自定义主题色板：`src/styles/global.css` 顶部 `:root` 变量
