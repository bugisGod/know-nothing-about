# 全站审查报告 · 2026-10-26（第二次）

> 范围：星团系统修复复核 + 数据层/后台/页面/部署链全量走查。
> 方法：静态源码比对 + **组件逻辑实跑（Node 求值 MiniGalaxy 前端脚本）** + 真实 SSR 起服抓产物 + 项目自带 32 项自审。
> 实测环境：`dist/`（02:30 构建，晚于全部源码改动）+ SSR:4399 + admin:4398 + 本地 `admin/data/admin.db`（3 笔记 / 1 项目 / 12 草稿）。
> 结论：**上一轮 8 项修复全部到位、无回归**（自审 32/32 通过、三处配色逐字节一致、NaN 坏点归零）；
> 但**本轮新查出 2 个 P1 实锤 bug**，其中一个是上轮修复的「修好了 NaN 但坐标本来就是错的」。

---

## 一、新发现的问题（按优先级）

### P1-A · 知识库卡片的「星链珠串」坐标少乘团半径，整条结构被团心主星吞掉

`src/components/MiniGalaxy.astro:160-161`：

```js
x: +(C + cx + tx * al + tx * w).toFixed(1),   // ← cx / al / w 全是「团半径为单位」的归一值，没有 × rad
y: +(C + cy + ty * al + ty * w).toFixed(1),
```

同文件另外两组点是乘了的——团块密核 `:174` `+(C + (cx + ddx) * rad)`、基底 `:191` `+(C + ex * rad)`；
首页 `BrainGraph` 的成员散星也是乘的（`:2859-2863`，`clusterFrame` 返回值即归一值 × 团半径）。

形态参数里 `ch.rr0 = 0.28~0.58`、`|ch.arc| = 0.5~1.05`、`ch.w = 0.06~0.11`——
珠串的**整条链长只有 0.5~1.05 像素**（团半径 rad = size×0.3 = 39.6px），
而卡片最后一步在团心画的白色主星辉光半径是 `size×0.13 ≈ 17px`（`:256`）→ 珠串全部落在主星光晕里，画了等于没画。

**实跑证据**（把组件前端脚本原样抽出来在 Node 里求值，seed 与页面一致）：

```
cat:ai       R=39.6 | 点云 320 | 落在距心 3px 内的点 29 | 距心 >0.3R(11.9px) 的点 252 | NaN 0
cat:frontend R=39.6 | 点云 320 | 落在距心 3px 内的点  2 | 距心 >0.3R(11.9px) 的点 288 | NaN 0
```

即卡片上除团块/基底外**没有任何中等半径尺度的结构点**——星链本该是「2.2px 大亮珠、一眼可辨的结构高光」，
现在不存在。这条与首页形状不一致的程度，比上轮报的 NaN 更严重（NaN 只影响 `nBead=1` 一种取值，这条影响**所有带链的团**，约 55% 的团有 ≥1 条链）。

**修复**（两处，同一段内）：`cx/cy` 与 `al/w` 都乘 `rad`：

```js
const cx = Math.cos(ch.th0) * ch.rr0 * rad, cy = Math.sin(ch.th0) * ch.rr0 * fy * rad;
...
const al = (-ch.arc / 2 + (ch.arc * i) / (nBead - 1)) * rad;
const w = (rand() - 0.5) * ch.w * 0.7 * rad;
```

`tx/ty` 是单位方向向量，不动。⚠️ 改完必须重新做一次两侧形状一致性验证（首页不用珠串，卡片形状会变，视觉基线要重取）。

### P1-B · 后台项目列表读「已退役的 md 文件」，新发布的项目在后台永远不出现

`admin/src/projects.js:15-34` `repoProjects()` 用 `readdirSync(SCIO_SRC_DIR/src/content/projects)` 数已发布项目；
而发布管线 v2 只写 `posts` 表、**不再落 md**（`admin/src/repo.js:18-22` 注释：「SSR 化：读文件会漏新文章」）。
笔记侧已经改成读库（`listRepoNotes()` 走 `posts` 表），**项目侧漏改**。

后果：发布一个项目后，线上 `/projects/` 有它、首页银河有它，但后台「项目复盘」列表显示 `已发布 0`，
也拿不到「转入编辑」入口 → 想改已上线的项目只能重写一份新 slug。
自审脚本的 `项目列表含真实项目` 这项之所以通过，是因为仓库里还留着迁移期孤儿 md `个人网站搭建.md`——**它掩盖了这个 bug**。

**修复**：`repoProjects()` 改为 `SELECT category, slug, title, date FROM posts WHERE kind='project' ORDER BY date DESC`（与 `listRepoNotes()` 同款）。

### P1-C · sitemap.xml 每条 loc 都是 `undefined/...`，等于没有站点地图

`src/pages/sitemap.xml.js:11` 用 `${SITE.url}`，但 `src/config.ts:2-28` 的 `SITE` 对象里**没有 `url` 字段**
（域名只写在 `astro.config.mjs` 的 `site`）。抓真实产物：

```
<url><loc>undefined/</loc></url>
<url><loc>undefined/notes/</loc></url>
<url><loc>undefined/notes/ai/深入理解ai-agent-第一章读书笔记/</loc></url>
```

对比 `rss.xml.js` 用的是 `context.site`（正确，实测输出 `https://nihilscire.com/...`）。
`<loc>` 必须是绝对 URL → 整份 sitemap 对爬虫无效。自审只断言了「含 `urlset`」，所以没抓到。

顺带两个同源缺陷：
- 中文 slug 未做 percent-encode（sitemap 规范要求 URL 转义），且 `<loc>` 里的中文对部分爬虫不友好；
- `urls` 只列了 `/` `/notes/` `/projects/` `/about/` `/search/` + 文章页，**没有 `/notes/topic/*` 与 `/notes/series/*`**（这两个是有内容的可索引页）。

**修复**：`SITE` 加 `url: 'https://nihilscire.com'`（或 sitemap 直接用 `Astro.site`），补 topic/series 路由，`encodeURI` 一遍。

### P2 清单

| # | 问题 | 位置 | 说明 |
|---|---|---|---|
| P2-1 | 大小写混用 URL 行为不统一：slug 段大小写不敏感、分类段敏感 | `src/lib/posts.ts:137`（只有 `slug=?` 带 `COLLATE NOCASE`，`category=?` 没带） | 实测：`/notes/ai/<中文slug>/` 200、`/notes/AI/<同 slug>/` 404；`/notes/topic/AI/` 200 但空态（`文章数: undefined`）、`/notes/?category=AI` 前端筛不出。后台草稿允许输入带大写的分类名，一旦这样建过文章就会出现「链接进不去」 |
| P2-2 | 每个页面重复全表 `SELECT *`（含 `html`+`content_md` 全文）3~6 次 | `galaxy-data.ts:17`、`notes/index.astro:9`、`topic/[cat].astro:72`、`[...slug].astro:7,21`、`rss.xml.js:7-8` | 4 篇内容下首页 HTML 已 258KB；内容到几十篇时是 O(n) 次全文读 + 内联 payload 膨胀。列表/配色场景只需要元数据，应加一个 `listNotesMeta()`（不选 html/content_md） |
| P2-3 | `src/content/**` 孤儿 md + `src/content.config.ts` 死配置仍在仓库 | `src/content/notes/{ai,frontend}`、`src/content/projects`、`src/content.config.ts` | 发布 v2 不落 md，站点也不读 astro:content（全站已无 `getCollection`）。留着既误导（P1-B 的掩盖效应就是这么来的），又让 `npm run build` 白跑一次内容集合扫描 |
| P2-4 | README 日常维护章节与架构脱节 | `README.md:24-45` | 仍写「`src/content/notes/<分类>/<slug>.md` 写完发布即时生效」「`mkdir src/content/notes/<新分类>`」——那是静态版流程；现在唯一入口是后台（写 `posts` 表）。按 README 操作的新内容会静默不上线 |
| P2-5 | 发布管线对**外部未授权进程**不传 SAFE 清洗 | `admin/src/server.js:139-147`（PUT 草稿写 `category`/`slug` 时不过 `SAFE()`，而 `notes.js:115` 转入编辑时清洗） | 当前 SSR 发布只进库、不进路径，故不构成穿越；但 `noteFileContent()`（`repo.js:40-44`）仍会把 `cat/slug` 拼成文件路径读，留着就是下一次「读 md」类改动的地雷 |
| P2-6 | `analytics` 表只增不清 | `admin/src/db.js:88-95`、`server.js:103-112` / `src/pages/aa.ts` | `/aa` 公开无鉴权，任意人可刷行（`path` 参数自由填）。无保留策略 + 无速率限制 → 库体积随时间线性涨，而备份走的是 `VACUUM INTO` 全量镜像 |
| P2-7 | `/aa` 双实现，线上路径只走 admin 那份 | `src/pages/aa.ts` vs `admin/src/server.js:103`，Caddy `handle /aa → 4322` | 站点那份只在直连时生效。同一份统计两套写入代码，改一边就会漂 |
| P2-8 | 发布失败时可能把本地敏感/临时文件带进 commit | `admin/src/publish.js:166-169`（`git add -A` + 仅在 `SCIO_GIT_PUSH=1` 才推） | 服务器仓库若残留未忽略的临时文件会被提交。历史干净（`server.ini` 从未入库，已核）。建议 `git add` 改白名单：`public/images`、`src/data/tags.json` |
| P2-9 | 形态/配色逻辑仍是 BrainGraph 与 MiniGalaxy 两份手写 | `BrainGraph.astro:2052-2144` vs `MiniGalaxy.astro:75-137` | 上轮建议的共享模块 `cluster-morph` 未落地，P1-A 这类「一侧漏乘 rad」正是双写的直接产物 |

### P3（顺手可清）

- `src/pages/search.astro:1` 文件开头有 UTF-8 BOM（实测渲染产物 `<!DOCTYPE` 干净，Astro 编译器吞掉了，纯仓库卫生）。
- `admin/src/publish.js:12` import 的 `buildFrontmatter`、`admin/src/server.js:218-219` 的 `const ct = ...; void ct;` 均为死代码。
- `deploy/DEPLOY.md` 未提 `SCIO_AUDIT_PASS`：`admin/src/db.js:27-37` 首启若无 `users` 行且缺 `SCIO_ADMIN_PASS` 直接 `process.exit(1)`，按手册顺序（第 3 步启服务、第 8 步才配 audit 密码）没问题，但本地新库直跑 self-audit 会踩；建议 README/DEPLOY 补一句。

---

## 二、上一轮 8 项修复的逐项复核（结论：全部到位，无回归）

| 原问题 | 复核证据 |
|---|---|
| P0 专题页 `--tc` 恒 `undefined` | `topic/[cat].astro:72-85` 改为全量 `assignClusterColors` + `reserved=[PROJECT_COLOR]` 取本团色；实测 `/notes/topic/ai/` = `#8fc27a`、`/notes/topic/frontend/` = `#a892d8`，与首页/知识库逐字符一致 ✅ |
| P1 `nBead=1` 除零 NaN | `MiniGalaxy.astro:155` `Math.max(2,…)`；实跑 `cat:ai`/`cat:frontend` 两团 NaN 点均为 0，页面产物无 `null` 坐标 ✅（但见 P1-A：修了 NaN，坐标本身是错的） |
| P1 首页未传 `reserved` | `galaxy-data.ts:124-127` 已传 ✅ |
| P1 色板耗尽撞色 | 两段式实现在 `config.ts:111-138`：主段遍历顺序未动（`base = h % stage.length` 按段各算），扩容段仅在主段无候选后参与，兜底改取「未占用色中色相距离最大」。12 团自审撞色归零 ✅ |
| P2 空分类无名空团 | `galaxy-data.ts:47-50`：`cat` 为空即 `continue` ✅ |
| P2 topic 双写兜底不一致 | `topic/[cat].astro:10-12` getStaticPaths 与 SSR 分支统一为 `""`；但注意 SSR 分支下 `/notes/topic/AI/` 会渲染空态页而非 404（P2-1 的子项） |
| P3 `gid` 死代码 | `MiniGalaxy.astro` 已无 `gid` ✅ |
| P3 `deploy.py` 废弃标注 | `deploy.py:1-4` 顶部已标废弃，且 `deploy/DEPLOY.md` 为现行手册 ✅ |

**已知遗留（上轮就标了未修，状态不变）**：

- 卡片不乘 `0.75` 盘压扁、`zOf` 不消费 `thick/cz/zA`（`MiniGalaxy.astro:121,128-137`）→ 立体表现与首页不同源。P2。
- 16.8% 的新团无内部结构（退化为纯椭圆，`BrainGraph.astro:2070,2076`）。已通过 `CATEGORIES.shape` 留了人工覆盖位（dbc7add），概率本身未改，属可接受。
- three.js 747KB 未懒加载、首页 HTML 258KB（见 P2-2）。生产有 Caddy `encode` 兜底，本地靠 `middleware.ts` gzip。

---

## 三、本轮用到的验证方式（可复跑）

```bash
# 1. 起 SSR（dist 已是最新，无需重建）
SCIO_DB=admin/data/admin.db PORT=4399 HOST=127.0.0.1 node dist/server/entry.mjs &
# 2. 起后台
(cd admin && SCIO_ADMIN_PORT=4398 node src/server.js) &
# 3. 项目自带 32 项自审 → 32 通过 / 0 失败
SCIO_SITE_URL=http://127.0.0.1:4399 SCIO_ADMIN_URL=http://127.0.0.1:4398 node scripts/self-audit.mjs
# 4. 配色一致性实锤：解析首页 graph-data payload + 知识库/专题页 --tc
# 5. 卡片几何实跑：抽出 MiniGalaxy 前端脚本用 node:module stripTypeScriptTypes 求值，
#    统计点云距团心的分布（P1-A 的证据来源）
```

自审脚本的**覆盖盲区**（建议补 4 条断言，否则同类问题还会静默复发）：

1. `sitemap.xml` 每条 `<loc>` 必须以 `https://` 开头（现在只断言含 `urlset`，P1-C 就是从这条缝里过的）；
2. `rss.xml` 的 `<link>` 同理；
3. 卡片点云的「结构点半径」分布：至少若干点落在 `0.15R~1.0R` 区间（P1-A 的可断言形态——现在这条完全不成立）；
4. 后台项目/笔记「已发布数」= `posts` 表对应 kind 的行数（P1-B 的可断言形态——现在断言的是「列表里有那篇孤儿 md」）。

---

## 四、建议动手顺序

1. **P1-A**（卡片珠串 `× rad`）+ 重取视觉基线 —— 用户最在意的「形状一致」承诺，现在缺的不是 NaN 而是整条链；
2. **P1-C**（sitemap `SITE.url`）—— 一行改动，SEO 面止血；
3. **P1-B**（后台项目列表读库）+ 顺手删 P2-3 孤儿 md/死配置（否则 bug 继续被掩盖）；
4. **自审脚本补那 4 条断言** —— 上面三个 P1 全部是「页面 200、自审全绿」的问题，
   只有加断言才能防复发；
5. P2-1（大小写）、P2-2（查询裁剪）、P2-4（README）。

---

## 五、本次会话已实施（2026-10-26 晚，未提交）

| 条目 | 状态 | 实测 |
|---|---|---|
| P1-A 卡片珠串漏乘 `rad` | ✅ 修 + 按用户意见降亮（0.30~0.46 → 0.22~0.34）+ 稀珠（×0.6） | ai 团珠串 18 颗落在 0.26~0.77R，NaN 0 |
| P1-B 后台项目列表读退役 md | ✅ 改查 posts 表 | 后台「已发布 1」 |
| P1-C sitemap `SITE.url` 不存在 | ✅ 改 `context.site` + `encodeURI` + 补 topic 路由；**series 不补**（跳转壳） | loc 全部 `https://nihilscire.com/...` |
| P2-1 大小写三层不一致 | ✅ 写入侧归一（草稿 PUT / 发布 upsert / 下架删除 / 回滚脏标记）+ 读取侧（`toNote` 输出小写、`getNote`/`listNotes` NOCASE）+ 专题页 301 与未知分类 404 + `scripts/normalize-categories.mjs` 清历史脏 key | 插 `PHOTO` 分类 → 首页只出 `cat:photo`；`/notes/topic/PHOTO/` 301；未知分类 404 |
| 分类元信息后台可配（label/desc/color/shape） | ✅ 新增 `categories` 表 + `admin/src/categories.js` 管理页 + 发布导出 `src/data/categories.json` + 站点 `src/lib/category-meta.ts` 合并层（代码默认值兜底，未注册分类行为不变） | 注册 ai 后首页/知识库/专题页三处同步显示中文名与描述 |
| tags 发现区读退役 md（P1-B 同款） | ✅ `discoverRepoTags` 改查 posts 表 | — |

**验证**：self-audit 32/32；rollback-proof 在干净克隆上 3/3（工作区内那次 FAIL 是「未提交改动拒绝发布」护栏正常触发，非回归）；
发布管线实跑导出 `categories.json` 成功；测试数据与临时克隆已清理。

**自审脚本已补值级断言**（13 项 → 45 项，`scripts/self-audit.mjs`）：sitemap/RSS 的 `<loc>` 与 `<link>`
必须是绝对地址且已编码、知识库卡配色集合 = 首页星团配色集合、每个专题页 banner 色 = 首页该团色、
卡片星链必须铺在团的尺度上（组件自报 `morph.beadR`）、后台「已发布数」= 首页对应星数、
星团 key 全小写、大写专题页 301、未知分类 404。**已做负向验证**：把 P1-A 的漏乘 rad 改回去，
断言如实报红（`链1条但beadR=0.013`）——不是又一条「只看 200」的空断言。

**仍未做**：P2-2 页面级重复全表读全文、P2-3 `src/content` 孤儿数据与 `content.config.ts` 死配置、
P2-4 README 静态版流程、P2-6 analytics 无保留策略、P2-7 `/aa` 双实现、P2-9 形态逻辑双写。
