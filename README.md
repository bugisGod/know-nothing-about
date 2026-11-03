# scio · 个人站点

> scio — 拉丁语「我知道」，出自 *Scio me nihil scire*（我知道我一无所知）。

个人名片 + 知识库 + 项目复盘。**SSR 动态站（2026-10-19 起）**：内容真身在 SQLite
（admin.db），页面实时渲染，后台写库即时上线——不再走「md 构建」的静态流程。

技术栈：[Astro](https://astro.build)（SSR）· TypeScript · [three.js](https://threejs.org)（首页银河）·
[Pagefind](https://pagefind.app)（搜索）· SQLite（node:sqlite）· [Hono](https://hono.dev)（后台）。

## 快速开始

```bash
npm install
npm ci 前注意：admin/ 是独立 package，需在 admin/ 目录再执行一次 npm ci
npm run build     # 构建产物 dist/server + dist/client
npm run start     # 起 SSR（127.0.0.1:4321）+ pagefind 索引兜底
```

后台：`cd admin && npm ci && SCIO_ADMIN_PASS=<密码> SCIO_DB=<库路径> node src/server.js`
→ http://localhost:4322/admin/

## 日常维护（唯一入口：管理后台）

一切内容操作在 **`/admin`**（笔记编辑器 / 项目 / 标签 / 分类元信息 / 发布历史+一键回滚）：

- **写文章**：后台新建 → 编辑器（自动保存 / 预览 / 图片粘贴拖入）→ 发布，**写库秒级上线**
- **加分类**：后台笔记选新分类名即可——首页星团（自动配色+形状）、知识库专题卡、
  筛选地址三处全自动；想覆盖中文名/描述/颜色/形状种子，才动 `src/config.ts` 的 `CATEGORIES`
- **下架 / 回滚**：发布历史页，一键操作（发布前自动做内容快照）

> ⚠️ `src/content/` 下的 md 文件**不是线上内容的来源**——它只是首次部署时
> `scripts/migrate-content.mjs` 的迁移源数据。改这些 md 不会上线，别被误导。

## 架构与部署

```
访客 → Caddy（encode + 安全头 + 分流）
        ├─ /admin*        → scio-admin（Hono 后台，127.0.0.1:4322）
        └─ 其余           → scio-site（Astro SSR，127.0.0.1:4321）
                                └─ 两者共用 SQLite：/var/lib/scio/admin.db（内容真身）
```

- 发布=写库即时生效；搜索索引由启动脚本兜底 + 发布时重建
- 回滚两层：**内容级**＝后台一键回滚（发布前自动快照）；**代码级**＝服务器
  `git checkout 上一版 && npm run build && systemctl restart scio-site`
- 完整服务器手册（Node 22 / systemd 双服务 / Caddy / 首次部署 / 验证清单）：
  **[deploy/DEPLOY.md](deploy/DEPLOY.md)**——服务器操作只看这份

## 本地开发注意

- 数据库路径：环境变量 `SCIO_DB`（站点、后台、迁移脚本、回滚验证四处必须指向同一个库）
- 搜索索引是异步重建的：`start.mjs` 起服后**等几秒再跑 self-audit**，否则假失败
- 自审回归：`SCIO_DB=... SCIO_SITE_URL=... SCIO_ADMIN_URL=... SCIO_AUDIT_PASS=...
  node scripts/self-audit.mjs`（46 项值级断言；rollback-proof.mjs 验回滚语义）

## 首页银河（src/components/BrainGraph.astro）

- 知识专题 = 星团（形状/颜色由分类名哈希自动生成，`CATEGORIES.shape` 可覆盖）；
  文章 = 星；探索态自由漫游，点星团页内聚焦，文章行点击进文章
- 调试口：URL 加 `?debug=1` 暴露 `__gal`
- 排障铁律：**先枚举点击时所有变化的量、逐帧采值找离散跳变，再改代码**；
  交互层改动上线前必须做真实点击命中测试（elementFromPoint），构建过 ≠ 能用

## 其它

- 知识库支持 `?category=分类名` 分享地址；大写分类名 301 归一
- 阅读页宽屏右侧目录（ArticleToc），窄屏折叠
- `prefers-reduced-motion` 会关闭星尘动画与流星
- 自定义主题色板：`src/styles/global.css` 顶部 `:root` 变量
