# 后台功能需求评估 · 6 项（2026-11-24）

> 本轮**只审查、未改任何代码**。范围按用户指定：git 身份相关事项全部排除，只留功能需求。

## 结论

6 条都可行，且彼此有依赖，建议**按 3 批做**而不是并行铺开。

三条必须先说的判断：

1. **需求 5（发布范围）不是"优化"，是当前的真实风险**：编辑器上那颗「保存并发布上线」按钮，实际执行的是**全库所有脏草稿一起发布**。库里现在就有 2 个 `published_at IS NULL` 的草稿，点一次会同时上线两篇。自动化每天跑之前必须先收口。
2. **需求 1（真预览）比看上去重**：后台用 `marked`，线上用 `src/lib/md.ts`（remark-gfm + shiki 代码高亮 + github-slugger 锚点），两者产物不同；后台还自己写了一套 `.ed-preview` CSS，跟站点 `.prose` 完全无关。更要命的是 `@media(max-width:820px){.ed-preview{display:none!important}}` —— 手机上预览被**强制隐藏**。所以现在的预览既不像、也看不到。
3. **需求 3 在「项目复盘」编辑器里是从无到有**：笔记编辑器有 `uploadImage()` + 粘贴/拖拽，项目编辑器**连粘贴/拖拽都没有**，只有纯 textarea。

另外发现一个会让「真预览」翻车的交叉点：**刚上传的图片在预览里会 404**。`/admin/api/media` 把文件暂存在 `admin/data/media`，正文写 `/images/<name>`，要等发布管线才搬进 `public/images`。预览走站点静态根时取不到这张图。

---

## 一、现状 → 建议（参数级）

| # | 需求 | 现状 | 建议 | 主要落点 |
|---|---|---|---|---|
| 1 | 真预览 | 客户端 `marked.parse()` → `.ed-preview` div；后台自绘 CSS；窄屏 `display:none!important`；无编辑/预览切换；无页头/TOC/灯箱/域色 | 服务端用 `renderMarkdown()`，套**真实详情页模板**；iframe 承载；编辑/预览 tab 切换；手机可用 | 站点预览路由 + 两个编辑器 + `views.js` CSS |
| 2 | 发布确认框 | `confirm('保存并构建发布上线？')` ×2；另有 `alert()` 上传失败、4 处 `confirm()` 删除/回滚 | 页内 `<dialog id="publish-confirm">` + 稳定选择器 `#publish-confirm-ok` / `data-testid`；与需求 5 的清单合并成同一个弹窗 | `notes.js` / `projects.js` / `views.js` |
| 3 | 上传按钮 | 笔记：仅粘贴/拖拽；项目：**无**；共用 `/admin/api/media` | 两个编辑器都加 `<input type="file" accept="image/*">` + 「上传图片」按钮，复用 `uploadImage(file)`；项目补齐粘贴/拖拽；`alert()` 换行内状态 | 两个编辑器 |
| 4 | 失败原因 | `publishes.log` 有值但**列表不展示**；且 `run()` 的 stdout/stderr 只推客户端、没写进 DB → 失败记录里往往只有「退出码 1」，没有报错原文 | 列表加展开详情（`esc(log)`）；把构建输出同步写进 `log`；失败行标红 + 错误首行；补 `trigger`/范围字段 | `publish.js` / `views.js` / `server.js` |
| 5 | 发布范围 | `POST /admin/api/publish` 无参数 → `SELECT * FROM drafts` + 脏过滤 → 全量发布 | 接受 `{ draftId }` 只发当前篇；新增 dry-run 清单接口，与确认弹窗合并展示；「发布全部草稿」降级为发布历史页独立入口 | `publish.js` / `server.js` / 两个编辑器 |
| 6 | 封面字段 | **全站无 cover 字段**；`Base.astro:57` 的 `og:image` 固定 `/og.png`（全站一张）；代码里也**没有**「取正文第一张图」的逻辑 | `drafts.fm.cover` → `posts.cover` → 详情页 `og:image` 绝对化；未配置回退 `/og.png` | `db.js` / `publish.js` / `Base.astro` / 详情页 / 编辑器 |

> 关于 #6：代码里没有「靠正文第一张图凑封面」的实现。实际现象应该是**社交平台抓不到文章级 og:image，自动 fallback 到正文第一张图**。所以这条需求的实质是「让每篇文章能指定分享封面」，不是替换已有抽图逻辑。

---

## 二、逐条方案与风险

### #1 真预览（改动最大，建议单独一批）

三个方案，我推荐 **A**：

| | 做法 | 优点 | 代价 |
|---|---|---|---|
| **A（推荐）** | 站点侧加受保护路由 `/__draft-preview/:id`，从 `drafts` 表读（站点与后台共库 `SCIO_DB`），复用**真实详情页模板**渲染；后台 iframe 嵌入 + tab 切换 | 100% 所见即所得；模板/CSS/TOC/灯箱/域色以后自动同步，不会有第二套样式漂移 | 要动站点公开路由；必须做鉴权（复用 admin session cookie 或一次性 token），否则未发布草稿会被公网看到 |
| B | 后台 `/admin/preview/:id` 用 `renderMarkdown()` + 引入站点编译后的 CSS chunk + 复刻详情页 DOM | 不碰公开路由，安全边界清晰 | DOM 是复刻，模板一改就漂移（项目里形态/配色双写已吃过亏） |
| C | 只把 `marked` 换成 `renderMarkdown` + 引站点 CSS，仍是 div 预览 | 最轻 | 不算「真实模板」，页头/TOC/灯箱仍缺 |

**必须一起解决的两件事**：
- 预览图片的暂存区映射：`/images/<name>` 在预览态要能从 `admin/data/media` 取到，否则刚上传的图一直裂。
- 窄屏：把 `.ed-preview{display:none!important}` 换成 tab（编辑 / 预览两个视图互斥），iframe 在手机上按视口宽度自适应。

### #2 发布确认框（自动化前提）

原生 `confirm()` 在 Playwright/CDP 里会触发 dialog 事件，默认被 dismiss，脚本拿不到「确定」。改成 `<dialog>` 后给稳定选择器：

```
<dialog id="publish-confirm">
  <button id="publish-confirm-cancel">取消</button>
  <button id="publish-confirm-ok" data-testid="publish-confirm">确认发布</button>
</dialog>
```

顺带把 `uploadImage()` 失败时的 `alert()` 也换成行内状态（同一类自动化阻塞）。其余 4 处 `confirm()`（删草稿 ×2、回滚、删标签、撤销分类）建议统一换掉，但不属于本次必须项。

### #3 上传按钮（最轻，半天内）

`uploadImage(file)` 和 `/admin/api/media` 都已存在，笔记侧只缺一个 `<input type="file">` + 按钮。项目侧需要把整段上传逻辑补齐（可直接抽成共享片段，避免两处双写）。返回值里 `dest` 已拼好 `/images/<name>`，无需改接口。

### #4 失败原因（两处补齐，不能只改前端）

现在只改列表是不够的。`publish.js:18-27` 的 `run()` 把 `stdout/stderr` 传给 `log()`（只推 NDJSON 给编辑器），没有进 `logText`（存 DB 的那份）；失败时 `cap()` 只写了 `e.message`。所以「报错原文」在 DB 里其实**不存在**。需要：
- `run()` 的输出同步 `cap()`，或新增 `error_detail` 字段；
- 失败时把完整 stderr 末尾一段单独存；
- 列表用 `<details>` 展开 `esc(p.log)`，失败行默认高亮。

### #5 发布范围（优先级最高）

`publish.js:84-101` 的 `drafts` 查询加 `AND id=?`；`publishStream({ draftId })`；`POST /admin/api/publish` 读 JSON body。

**推荐把 #2 和 #5 合并成一个弹窗**：点「发布」→ 先请求 dry-run 清单（用同一套脏过滤规则算出本次会「上线 / 下架」哪些草稿）→ 弹窗列出清单 + 确认按钮。这样既默认只发当前篇，又保留「看清再发」的兜底，自动化脚本也只需点一个稳定按钮。

**两个连带风险**：
- 单篇发布仍会跑 git commit / pagefind 全量重建，日志要写清范围，别让人误以为只动了这一篇。
- 回滚仍是 posts 全表快照（不是单篇），单篇发布后的「回滚上一版」会整体回滚，UI 上要写明白。
- 无人值守发布的另一道坎：`publish.js:54-58` 的 `SRC_DIR` 脏检查会让服务器仓库有未提交改动时直接拒绝发布（当前服务器上还留着 `.bak` 未跟踪文件）。这条属于「git 身份先放一边」的范围之外，但自动化上线前必须确认，否则每天第一次发布就会失败。

### #6 封面字段（数据模型改动，建议最后一批）

链路：`drafts.fm.cover` → 编辑器输入（可直接复用 #3 的上传按钮）→ `posts.cover`（`ensurePosts` 用 `ALTER TABLE ... ADD COLUMN` 兼容旧库）→ `publish.js` upsert → 详情页把 `cover` 绝对化后传给 `Base` 的 `ogImage` prop → 未配置回退 `/og.png`。

`SITE.url` 已存在，`new URL(cover, SITE.url).href` 即可；相对路径 `/images/...` 和外链都要支持。

---

## 三、优先级与分批（依赖关系）

| 批次 | 内容 | 为什么排这里 |
|---|---|---|
| **1 · 自动化前提** | #5 发布范围 → #2 确认弹窗（合并清单）→ #4 失败原因 | 三者都在发布链路，改动内聚；不做完 #5 就不能让脚本每天自动点发布，否则会误发全库草稿 |
| **2 · 编辑器体验** | #3 上传按钮（先做，顺带解决预览图片暂存映射）→ #1 真预览 | #1 依赖 #3 的上传链路；真预览建议再拆两步：先换渲染器 + tab 切换，再上真实模板路由 |
| **3 · 数据模型** | #6 封面字段 | 涉及 DB schema + 发布管线 + 站点模板，独立一批最安全 |

单条复杂度：#3 < #4 < #2 < #6 < #5 < #1。

---

## 四、需要你拍板的 4 点（括号内是我的推荐）

1. **真预览走哪条路**：A 站点预览路由（推荐，100% 真实但要加鉴权）/ B 后台复刻模板 / C 只换渲染器。
2. **发布默认范围**：只发当前篇 + 清单在弹窗里展示（推荐，#2/#5 合一）/ 每次都列清单确认 / 保留全量但加二次确认。
3. **预览里刚上传的图片要不要可见**：要（推荐，需加暂存区映射路由）/ 不要，发布后才看。
4. **封面要不要在页面内显示**：只做 `og:image` 分享封面（推荐，改动最小）/ 同时在文章页头或列表卡片显示。

---

## 五、现状证据（file:line）

| 事实 | 位置 |
|---|---|
| 预览用 marked、后台自绘样式 | `admin/src/notes.js:184-195`、`admin/src/projects.js:149-155`、`admin/src/views.js:131-139` |
| 窄屏预览被强制隐藏 | `admin/src/views.js:139` |
| 线上渲染器是另一套 | `src/lib/md.ts:1-10`（unified + remark-gfm + shiki + slugger） |
| 发布原生 confirm | `admin/src/notes.js:224`、`admin/src/projects.js` 发布段 |
| 上传接口与暂存 | `admin/src/server.js` `/admin/api/media`；`admin/src/notes.js:198-220`；搬运在 `admin/src/publish.js:134-151` |
| 全量发布 | `admin/src/publish.js:84-101`；`admin/src/server.js` `/admin/api/publish`（无 body） |
| 失败日志缺原文 | `admin/src/publish.js:18-27`（stdout 只 log 不 cap）、`:185-188` |
| 发布历史不展示 log | `admin/src/views.js:233-249` |
| `publishes` 表字段 | `admin/src/db.js:79-87` |
| og:image 固定 | `src/layouts/Base.astro:57` |

*审查阶段未修改任何代码；`git status` 干净，线上 `639b585`。*

---

## 六、实施记录（2026-11-24，按上述拍板方案全部落地）

### 已做

| # | 落地方式 |
|---|---|
| 1 真预览 | 抽 `src/components/ArticlePage.astro`，详情页与预览共用同一组件；站点侧 `draft-preview/[id]` 受 token 保护，`draft-media/[name]` 伺服暂存图片；后台编辑 / 预览 tab + iframe，手机可见 |
| 2 确认框 | `views.js:publishDialog()` + `editor-common.js:createPublishFlow()`，页内 `<dialog>`，稳定选择器 `#publish-confirm-ok` / `data-testid="publish-confirm"`；原生 confirm 从发布链路移除 |
| 3 上传 | 两个编辑器共用 `editor-common.js` 的上传逻辑（选文件按钮 + 粘贴 / 拖拽），失败写行内状态；封面有独立上传按钮 |
| 4 失败原因 | 构建 stdout/stderr 同步写进 `publishes.log`（限长 60KB），失败记 `e.stack`；发布历史 `<details>` 展开原文 + 失败首行标红 |
| 5 发布范围 | `collectDrafts(draftId)` 一个真源供 dry-run 与实际发布共用；编辑器默认只发当前篇，清单在确认弹窗里展示；全量发布降级为发布历史页独立入口 |
| 6 封面 | `drafts.fm.cover → posts.cover → og:image` 绝对化（只放行站内路径 / http(s) 外链），未配置回退 `/og.png`；按拍板**不在页面里显示**封面 |

### 部署前 bug 复查补修（两项）

1. **发布接口不传参数默认全量**（`server.js`）：`POST /admin/api/publish` 原来无 body 时
   `scope` 落到 `'all'` —— 旧脚本或误调会一键上线全部草稿，直接违背 #5。现改为
   `draftId` 与 `scope:'all'` **必须显式给一个**，否则 400；`/admin/api/publish/plan`
   同样不再无参默认全量。两条已加进回归断言。
2. **`og:image` 放行协议相对 URL**：`//evil.com` 以 `/` 开头，会被 `new URL()` 拼成外链；
   现排除 `//` 开头。

### 两个实现坑（可复用）

1. **Astro 路由不能以 `_` 开头**：初版 `src/pages/__draft-preview/` 全 404（Astro 把下划线目录视为私有、不生成路由），改名 `draft-preview/` 后正常。
2. **后台与站点双端口**：iframe 的相对 URL 会打到后台服务。编辑器注入隐藏字段 `site-base`（取 `SCIO_SITE_URL`），生产同域时留空走相对路径，本地用绝对地址。

### 验证

- `.shots/verify-admin-1124.mjs` **41/41**：隔离副本库上跑真实浏览器（上传按钮选文件、手机 390 预览 tab、弹窗打开 / 取消 / 自动化点确认），发布流程故意在 `SCIO_SRC_DIR` 为空的实例里失败，确认 `scope=single:<id>` 与报错原文写进 DB——**未触碰正式数据**。
- 常规回归：`self-audit 46/46`、探索态五阶段 `13/13`、移动端四视口无溢出且真实点击进文章页、Hallmark render 四视口零缺陷、构建通过、行尾无漂移。
- 截图：`.shots/adm-{editor,editor-preview,publish-dialog,real-preview,article,publishes-fail}-*.png`。

### 边界 / 未做

- 删除草稿、回滚仍用原生 `confirm()`（不在本次发布自动化链路里，保留防误触）。
- 回滚仍是 posts 全表快照，单篇发布后回滚会整表回退；弹窗清单里已写明。
- git commit 与 pagefind 重建仍针对全站，清单里已写明。
- `SCIO_SRC_DIR` 脏检查未改：无人值守发布前仍需确认服务器工作区干净（存在未跟踪 `.bak` 时需处理）。
- **已提交并部署**：本地 / GitHub `2c879c5`，服务器 `6a3c87b`（cherry-pick 内容等价）；
  线上端点、新路由鉴权、后台新 UI、发布接口防误发均已实测通过。

### 部署记录（2026-11-24 01:05）

服务器在部署前有自己的 3 笔 wenshu 发布提交 + 9 个 staged 发布产物。处理顺序：
先用 `git commit` 固化 staged 产物（让工作区干净，这是无人值守发布的前提），
再 `git fetch origin` + `cherry-pick 639b585..origin/main`，最后 `npm run build` +
`systemctl restart scio-site scio-admin`。**全程未用 `reset --hard` / `clean -fd`**。

线上实测：首页 / 知识库 / diskmap / pagefind / RSS / sitemap / 后台登录 /
`editor-common.js` 全 200；`/draft-preview/1`、`/draft-media/nope.png` 无 token 均 403；
线上笔记与项目编辑器页含 `preview-tab / upload-button / f-cover / preview-frame / publish-dialog`；
发布 plan 与 publish 无参均 400；文章页模板正常、og:image 回退 `/og.png`。
