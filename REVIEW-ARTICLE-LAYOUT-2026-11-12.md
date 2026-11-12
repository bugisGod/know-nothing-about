# 项目详情页排版审查 · `/projects/diskmap/`（2026-11-12）

> 用户反馈「标题啥的，布局不是很舒服」。本次只做诊断与方向，**未改任何代码**。
> 证据：线上页面真实渲染（CDP + Edge，1440×900 / 375×667），脚本 `.shots/audit-article-layout.mjs`，
> 截图 `.shots/diskmap-1440x900.png` / `diskmap-375x667.png`；模板 `src/pages/projects/[slug].astro`、
> `src/components/SkyBand.astro`、`src/components/ArticleToc.astro`、`src/styles/global.css`。

## 结论：三个根因，其中一个其实是 bug

1. **右侧「本文目录」是空的** —— 不是设计留白，是 TOC 挂了。
2. **文章头被拆成两截** —— 大标题在页头，元信息却在正文列开头，中间夹着大块空白与手机目录条。
3. **有一句现成的好简介没用上** —— `description` 只进了 `<meta>`，页面上看不见，页头因此只有「面包屑 + 光秃秃一个标题」却占了 237px。

## 一、实锤 bug：TOC 8 个链接全空

两个详情页模板都这样构造 headings：

```js
const headings = [...entryHtml.matchAll(/<h([1-6]) id="([^"]*)"/g)].map((m) => ({
  depth: Number(m[1]), slug: m[2], text: '',   // ← 永远是空
}));
```

`ArticleToc.astro` 直接渲染 `{h.text}`，所以线上 HTML 是：

```html
<aside class="article-toc"><nav><p>本文目录</p>
<a href="#一句话"></a><a href="#为什么做"></a>… 8 个空 a
```

桌面表现为「本文目录」+ 一条空竖线，手机展开后是 8 个点不到的空链接。**笔记详情页同样中招**，属全站问题。

- 修法：正则捕获开闭标签之间的文本，剥掉内部标签与实体，例如
  `/<h([1-6]) id="([^"]*)"[^>]*>([\s\S]*?)<\/h\1>/g` → `text = m[3].replace(/<[^>]+>/g,'').trim()`。
  这篇的 8 个标题正好是「一句话 / 为什么做 / 现在能做什么 / 它是怎么搭的 / 启动到出图，谁在等谁 /
  几个刻意的取舍 / 关键数据（本机实测） / 下载」，修完右列立刻有内容。

## 二、测量数据（线上真实渲染）

| 元素 | 1440×900 | 375×667 |
|---|---|---|
| 面包屑 | y=141 | y=95 |
| h1 | y=180，**64px / 700 Inter 无衬线** | y=134，28px / 700 |
| 页头结束 | y=310 | y=206 |
| page-meta（日期/角色/更新） | y=318（在 **article 内**） | y=288（页头结束后 **82px**） |
| sub-lines（技术栈 + 链接） | y=358，高 47px | y=324，**高 110px**（技术栈折成 2 行、链接另起 1 行） |
| 第一个 h2「一句话」 | y=453 | y=483 |
| 第一段正文 | y=509 | y=539 |
| 文章总高 | 3527 | 3812 |

**手机首屏 667px 里，从标题到第一段正文之间塞了：空白 → 本文目录折叠条 → 空白 → 三行元信息 →
技术栈两行 → 链接一行 → 横线 → 空白 → 才到「一句话」。** 头重脚轻非常明显。

另有：`d.description` 已存在且写得很好——
「电脑空间管理助手：一张能漫游的磁盘地图，每块地都属于某个软件、标着能不能动；清理与归并全部可撤销，
另有按天记账的 C 盘变动账本。」——但模板只把它传给 `Base` 的 meta，**页面上完全没显示**。

## 三、优化方向（按优先级）

### P0 · 先修 bug，一行见效
1. 两个详情页的 headings 提取补上 `text`，让 TOC 真正显示 8 个标题。桌面右列不再空、手机目录可用。

### P1 · 把文章头收成一个整体（观感主因）
2. **元信息上移**：项目页把 `page-meta` + `sub-lines` 从 `article` 挪进 `SkyBand`，紧跟 h1——
   与笔记详情页一致（笔记页本来就这么做）。标题不再悬空、左右两列起点也不用拿元信息对目录。
3. **补一句 lede**：把 `d.description` 显示在 h1 下方（衬线或常规字重，别抢标题），
   页头 237px 才算有内容；也顺带解决「只有光秃秃一个词」的观感。
4. **收紧 reading 页头留白**：`SkyBand` reading 变体单独调 `padding`（现 68/42）与 h1 的 `margin`（14/18），
   让桌面第一段正文从 y=509 提到 ~400，手机首屏能多露两行正文。
5. **手机 TOC 挪位**：`.mobile-toc` 现在夹在页头和正文之间制造 82px 空白；
   移到正文内第一个 h2 之前，或干脆收进文章头折叠区。

### P2 · 元信息降噪（手机尤甚）
6. 技术栈 `C# / .NET 10 / WPF / WinForms / SQLite / Ollama` 在 331px 宽折成两行；
   改成单行横滑（`white-space:nowrap; overflow-x:auto`）或「前 3 项 + 其余折叠」。
7. `page-meta` / `tech` / `links` 三排都是 12.5px 小字、主次不分；
   可合并成一行用中点分隔，或把技术栈与链接收成一个「项目信息」块放到文末。

### 需要你拍板的一项
8. **标题字体**：`SkyBand.astro:24-33` 的 `h1` 是 Inter **64px / 700 无衬线**，
   注释写「与知识库页标题同一标准，全站页头一致」——所以这是**有意的全站规范**，不是局部 bug。
   但它与站点 logo `scio.` 的衬线、以及你定的「衬线 + 琥珀句点」调性有张力。
   两个选项：
   - **A（小改）**：只给详情页 h1 加一个 `article-h1` 类，用 `--font-display` 600 + 稍小字号，列表页不动；
   - **B（全站）**：把 SkyBand h1 统一改衬线 600，知识库/项目/关于页头一起变。
   B 影响面大，建议单独一轮看截图再定。

### 顺带的结构建议
9. 笔记页与项目页的文章头各写一遍，正是历次「双写漂移」的来源（形态逻辑双写已经吃过亏）。
   建议抽一个 `ArticleHeader` 组件统一 crumbs / h1 / description / meta / tech / links。

## 四、不建议动

正文版式（720px / 16px / 行高 1.9，阅读宽度合适）、银色+琥珀配色、星空背景、探索态。
这篇的问题集中在「标题到正文之间那 300px」，不是正文排版。

## 五、状态

- **未改任何代码、未部署**；本地 4321 / 4322 / 4400 服务仍在跑。
- 线上页头与本地模板一致（SSR 动态渲染内容，模板没变）。
- 之前两轮改动（P0/P1 + 剩余清单）仍**未提交、未上线**。

---

## 六、补充：标签数量限制（用户「没必要加这么多」）

### 现状：入口不设限，出口各截各的

后台录入（`admin/src/notes.js:159`）：

```js
tags: $('f-tags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
```

只去空值，**没有数量上限**；输入框提示也只写「标签（逗号分隔）」，没给建议数量。

各消费端的截法互不一致：

| 位置 | 上限 | 文件 |
|---|---|---|
| 知识库列表卡片 | 2 | `src/pages/notes/index.astro:126` |
| 星图悬停摘要卡 `tip-meta` | 3 | `BrainGraph.astro:3422` |
| 星团描述行降级 | 3 | `BrainGraph.astro:3143` |
| 星团摘要卡 `tip-desc` | 5 | `BrainGraph.astro:3432 / 3442` |
| **笔记详情页** | **无上限，全量 `tags.map().join(" / ")`** | `src/pages/notes/[...slug].astro:61` |
| **项目详情页技术栈** | **无上限，全量 `d.tech.join(" / ")`** | `src/pages/projects/[slug].astro:40` |

`galaxy-data.ts:138` 的 `c.topicList` 由该团所有文章 tags 汇总，**本身也无上限**，
只靠上面的消费端截断。diskmap 这篇 `tech` 是 6 项（`C# / .NET 10 / WPF / WinForms / SQLite / Ollama`），
手机上折成两行，正是「标签太多」最直观的来源。

### 建议（参数级）

| 层 | 现状 | 建议 |
|---|---|---|
| 后台录入上限 | 无 | **5 个**，UI 提示改「逗号分隔，最多 5 个，建议 2–3 个」 |
| 页面展示上限 | 2 / 3 / 5 / 全量 四种 | 抽 `MAX_TAGS` 到 `src/config.ts`，统一 **3 个**（详情页可放宽到 5，超出显示 `+N`） |
| 项目技术栈 | 全量 6 项 | 显示 **5 项 + `+1`**，或单行横滑（与 P2 的降噪合并做） |
| `topicList` 生成 | 全量汇总 | 生成时即 `.slice(0, 5)`，别把无上限数组往下传 |

**关键边界**：入口限制只对**新编辑**生效，线上已有文章的多标签不会自动变少；
所以展示端兜底必须同时做，否则老文章照样摊一屏。若要彻底，可加一次数据清洗
（把历史 posts 的 tags 截到 5 个），但那属于改内容，需你单独批准。

**一处定义**：上限放 `src/config.ts`，避免又变成多处双写（形态/配色双写已吃过亏）。

### 与上一轮的关系

标签降噪建议和 P0（TOC 空链接）、P1（文章头收拢）**一起做**，都属于「标题到正文之间那 300px」的整理；
改完用同一套 `audit-article-layout.mjs` 复测桌面/手机的元素 y 坐标，确认首屏能多露正文。

---

## 七、实施记录（2026-11-12 03:00，用户「可以」+ 图片尺寸问题）

本轮把 P0 / P1 / 标签限制 / 图片 / Hallmark polish 一次做完，共 9 个源码文件 + 1 个新模块。

### 改了什么

| 项 | 落点 |
|---|---|
| **P0 TOC 空链接** | 新建 `src/lib/headings.ts` 的 `extractHeadings()`（捕获 `<hN id>…</hN>` 文本、剥标签、解实体），两个详情页模板改为共用；不再双写 |
| **P1 文章头** | 项目页 `page-meta` + `sub-lines` 从 `article` 内移到 `SkyBand` slot（与笔记页一致）；两个详情页都显示 `description` 作 lede；`SkyBand` reading padding 68/42→52/30、窄屏 32/24→28/18；手机 TOC 折叠条 margin 24→12、summary padding 12→9；`.sub-lines` 去掉分隔线与大 padding；`.tech` 去掉 mono |
| **标签限制** | `src/config.ts` 新增 `TAG_LIMITS{input:5, topicList:5, detail:5}`；后台笔记/项目录入截 5 并改 UI 提示；详情页显示 5 项、超出 `+N`；`galaxy-data.ts` 的 `topicList` 生成时截 5 |
| **图片突出** | `global.css` 新增 `article.prose figure.fig-wide{width:100%;max-width:100%;margin-left:0;transform:none}` + `figure img` / `figcaption` 规则。用 `article.prose` 提高特异性（0-2-2 > 0-2-1），压住服务器残留的 1200px 版本 |
| **Hallmark polish** | 文章页 4 处 11px→12px；h1 补 `overflow-wrap:break-word; min-width:0`（Floor 50） |
| **未动** | h1 字体（A/B 待拍板）、银河、状态机、配色、正文 720px/16px/1.9 |

### 实测前后（同一套 CDP 脚本）

| | 改前 | 改后 |
|---|---|---|
| `figure.fig-wide` 宽（1440） | **1200px** | **720px** = 正文列 |
| 突出正文列 | 左 240 / 右 240px | 0 / 0 |
| 与右侧目录水平重叠 | **176px** | 0（−64px） |
| 首图渲染高度 | 755px | 453px |
| TOC 链接文本 | 8 条全空 | 笔记 16 条 / 项目 10 条，全部有文字 |
| 桌面项目页首段正文 y | 509 | 486（且 lede + 元信息已提前到页头） |
| 手机项目页首段正文 y | 539 | 480，**首屏能看到「背景与目标」正文** |
| 手机笔记页首段正文 y | — | 437 |

### 验证

- `.shots/verify-1112.mjs`：**31 PASS / 0 FAIL**（6 个真实渲染 case：笔记/项目 × 桌面/手机、diskmap 镜像 × 桌面/手机）
- `scripts/self-audit.mjs` **46/46**；探索态五阶段 **13/13**；移动端四视口无横向溢出、文章行命中、375 真实点击进文章页
- `hallmark-render-audit.mjs` 四视口复查：小字 0 / 装饰层缺 aria 0 / 对比度不足 0 / 横向溢出 0
- 构建通过；所有改动文件行尾保持（无整文件重写）

### 边界与遗留

1. **本地 DB 没有 diskmap**（线上后台直接发布）。为验收 CSS 修复做了
   `http://127.0.0.1:4400/article-preview`（线上 HTML + 本地新 CSS）——它只验证**图片/间距**，
   TOC 文本、元信息上移、lede 等模板改动需**部署后**才出现在这篇上；
   本地同构项目页 `/projects/个人网站搭建/` 可看模板改动的完整效果。
2. **线上服务器有一条本仓库从未有过的 `fig-wide` 规则**（`git log --all -S "fig-wide"` 为空）。
   部署时应把服务器上那段手工 CSS 对齐/删除；本地新规则用更高特异性，即使残留也能压住。
3. **入口标签上限只管新编辑**，历史文章靠展示端 `+N` 兜底；清历史数据属改内容，未擅自处理。
4. **代码未提交、线上未部署**（线上仍是 `BOEGS_oN.js`）。
5. Hallmark `1`（h1 无衬线 vs `design.md` 锁定的衬线）仍**待拍板**，本轮刻意未动。

Hallmark 分级与 waive 依据见 `REVIEW-HALLMARK-ARTICLE-2026-11-12.md`（audit 动词，只出结论不改文件）。

---

## 八、主题回归（2026-11-12 17:30，用户「这个设计违背星空银河主题」+「主要风格要和整体网站搭配」）

**先认错**：第七节那版把「突出来很多」当纯布局 bug，用普通博客的尺子修成 720px 规整文档栏，
又叠加 Hallmark 的 polish（去 mono / 去箭头 / 字号统一），结果首页是可漫游的银河、
点进星团却掉回标准深色文档页。把「干净」误当成「规整」，方向确实错了。
按 `design.md` 该 waive 的是**规整**，不是沉浸。

### 做法：只复用站点已有语言，不引入新组件 / 新配色

| P | 落点 | 说明 |
|---|---|---|
| **P0 域色** | `galaxy-data.ts` 新增 `clusterColorMap()`；`Base.astro` 加 `clusterColor` prop 注入 `--cluster-color`（6 位 hex 校验）；笔记按 `cat:<category>`、项目用 `PROJECT_COLOR` | **复用首页 `assignClusterColors` 的同一份结果**，实测逐比特一致；新增分类零改码 |
| **P1 页头** | `SkyBand.astro` 的 `.reading`：h1 改 `--font-display` 衬线 600 / `clamp(36,4vw,52)` + 琥珀句点；元信息变一行观测坐标（域色星点 + `·` 分隔）；项目页 `sub-lines` 合并进 `page-meta` | 与首页 hero / about 页 `.id-dot` 同源 |
| **P1 星雾** | `.sky-band.reading::before` 用 `color-mix(... 13%)` 把**已有**星空染一层域色 | **不新增星点 DOM**：全站已有 `StarField` + 深空照片，`global.css` 注释明确警告再叠会双重曝光 |

后代选择器整段包进 `:global()`（避免 slot 内容不带 scope 导致选择器永不匹配，11-09 踩过同款坑）。
`about.astro` 也用 `<SkyBand reading>`，一并统一到衬线；它没传域色，安全 fallback 琥珀。

### 实测（`.shots/verify-theme-1112.mjs`，CDP 真实渲染）

| 检查 | 结果 |
|---|---|
| 首页团色 | `cat:ai=#8fc27a` / `cat:frontend=#a892d8` / `projects=#ffc46b` |
| 笔记页 `--cluster-color` | `#8fc27a` = 首页 ai 团 ✅ |
| 项目页 `--cluster-color` | `#ffc46b` = 首页项目团 ✅ |
| h1 | `Instrument Serif / Noto Serif SC`、600、桌面 52px / 手机 30px |
| 句点 | `rgb(217,184,121)` = `--accent` ✅ |
| 页头星雾 | `color(srgb … / 0.13)` 域色径向渐隐，无新星点层 ✅ |
| 元信息 | 桌面一行 22–23px；手机项目页 5 项折两行 52px（旧版三排 110px） |
| 回归 | TOC 文字非空、无横向溢出、图片仍 720px、`self-audit 46/46`、五阶段 `13/13` |

截图：`theme-home-1440.png`（首页基准）、`theme-note-1440.png` / `theme-note-375.png`、
`theme-proj-1440.png` / `theme-proj-375.png`、`theme-about-1440.png`。

### 待确认后再做

P2 配图观测窗化（羽化边缘 / 去硬边框 / 域色微晕）、P3 目录星轨 + h2 尾迹。
本轮按约定**只做 P0+P1 出截图确认调性**；`design.md` 第五节已把这套约定锁定。

