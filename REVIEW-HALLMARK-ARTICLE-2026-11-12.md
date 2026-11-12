# Hallmark audit · 文章详情页 `/projects/diskmap/`（2026-11-12）

## 0. 执行方式与声明

- 按 `redesign.md` 的 **`audit <target>`** 动词执行：**"audit stops here — It changes none of the project's files."**
  本文件只做分级、取证与建议，不是改造记录。
- 规则来源：`gates.md` §1/§4/§5、`redesign.md`（通过 WebFetch 取回原文；仓库完整 zip 在 11-09 因代理截断未下成，过程见 `.shots/hallmark/AUDIT-RULES-USED.md`）。
- 目标：线上 `https://nihilscire.com/projects/diskmap/`（真实浏览器渲染）+ 本地 `src/` 源码。
  本地 DB 无此文章（线上后台直接发布），因此排版模板类结论用本地同构文章页交叉验证。
- **改动归属要说清楚**：本轮 9 个源码文件的修改来自用户「可以」批准的
  `REVIEW-ARTICLE-LAYOUT-2026-11-12.md`（P0/P1/标签）与本轮指出的图片问题，
  **不是 audit 的产出**。Hallmark 在此只作为分级依据与交叉验证。
- 未跑 `sloplint.mjs`（依赖 puppeteer-core，本机未装且仓库 zip 未下成）；
  改用自建 CDP + Edge 脚本 `.shots/hallmark-render-audit.mjs`、`.shots/audit-fig.mjs`、`.shots/verify-1112.mjs`
  采集真实渲染证据，**不用静态猜测代替截图**。

## 1. The read（Hallmark 要求的四行）

1. **这个页面是做什么的**：给来访者读一篇项目复盘（DiskMap），唯一动作是读正文、用目录跳章节。
2. **什么有效、必须留下**：正文 720px / 16px / 行高 1.9 的 measure 合适；两张图是**真实的架构图与时序图**，不是画的插画或假产品 UI；面包屑是真实导航；目录结构、章节锚点齐全。
3. **什么读起来像生成的**：h1 是 64px/700 无衬线（`1`）；标题下三排 12.5px 小字铺开（`75`/`64`/`63`）；页头占 237px 却只有面包屑 + 一个光秃秃的标题（`77`/`79`）；中点与粘连箭头（`63`，已 waive）。
4. **什么坏了**：目录 8 个链接**全是空的**；`figure.fig-wide` 把图撑到 1200px，左右各突出正文列 240px、左边被裁 23px、右边盖住目录 176px；写得很好的 `description` 只进了 `<meta>`，页面上看不见。

## 2. 测量（CDP + Edge，线上真实渲染，非目测）

| 项 | 1440×900 | 375×667 |
|---|---|---|
| `document.scrollWidth / innerWidth` | 1425 / 1440（无横向滚动） | 375 / 375 |
| `.prose` 正文列 | x 217..937（720px） | x 22..353（331px） |
| `.article-toc`（桌面） | x 1001..1201（200px，sticky） | 隐藏，改 `details` |
| `figure.fig-wide` 改前 | **x −23..1177（1200px）** | x 16..359（343px） |
| `figure.fig-wide` 改后 | x 217..937（720px） | x 22..353（331px） |
| 改前突出正文列 | 左 240px / 右 240px | 左 6px / 右 6px |
| 改前与目录水平重叠 | **176px** | — |
| 图片渲染高度（首图） | 755px → 453px | 216px → 209px |
| 页头高度 / 首段正文 y | 237px / 509 | 206px / **539** |
| 图片原始尺寸 | `arch.png` 1400×880、`seq.png` 1400×780（比例 1.59 / 1.79，均正常） | 同左 |

> 结论：**图片本身尺寸没问题，是 CSS 把它撑坏了**。线上 `about.C14blTOd.css` 有一条
> `.prose figure.fig-wide{width:min(1200px,calc(100vw - 40px));max-width:none;margin-left:50%;transform:translate(-50%)}`。
> 而 `git log --all -S "fig-wide"` 为空 —— **这条规则从未出现在本仓库**，是服务器上线后另加的。
> 注入修正规则后实测 1440 图宽 1200→720、与目录重叠 176→0，手机 343→331。

## 3. Findings by tier

### Floor（Hallmark 判 `FAIL`，不可豁免；house rule 仅 `54/58/63/67`）

| Gate | 位置 / 证据 | 判定 | 最轻 depth |
|---|---|---|---|
| **34** Horizontal scroll / `100vw` | 线上 `about.C14blTOd.css` 的 `calc(100vw - 40px)`；桌面图左边被裁 23px | **FAIL**（虽未产生 scrollWidth 溢出，但 `100vw` 宽度明确命中） | polish |
| **73** Text painted under another element | 图与 sticky 目录水平重叠 176px，滚动到图时目录仍常驻 → 不透明图压住目录文字 | **FAIL** | polish |
| **50** display head 溢出保护 | `SkyBand.astro:24-33` h1 无 `overflow-wrap:break-word; min-width:0` | WARN，本次已补 | polish |
| **76** A broken image | 两张图 `naturalWidth=1400`、HTTP 200 | PASS | — |
| **33** 装饰层 aria | 11-10 已给 StarField svg / NebulaBand canvas / Three canvas 补齐 | PASS | — |
| **26a** `:focus-visible` | 全站已有 | PASS | — |
| **62** Content hidden at rest | 无 reveal 类；脚本关闭时正文仍可见 | PASS | — |
| **54** The eyebrow | 面包屑「项目复盘 / 已完成」在 h1 前，但它是 **destination**，不是 inert type → 不适用 | N/A | — |
| **58** The screen budget | 长文属 Long Document，不是 landing page；按 note 处理 | NOTE | — |
| **19 / 46a** Copy tells / 虚构指标 | 无 placeholder、无虚构数字/推荐语 | PASS | — |
| **63 / 67** house rule | 中点串、`02 ARTICLES` 类 tracked-caps、`✦` | **FAIL on the record，但已 `design.md` waive**（见 §6） | — |

### Reflex（报 `REFLEX`，可 on-the-record 豁免）

| Gate | 位置 / 证据 | 结论 |
|---|---|---|
| **1** Display face defaults | `SkyBand.astro:24-33`：h1 `clamp(40px,5vw,64px)` / `font-weight:700` / 无衬线，注释写「与知识库页标题同一标准，全站页头一致」；而 `design.md` 锁定「衬线作标题」 | **需用户拍板，本次未动**。A：只给详情页加衬线类；B：全站页头统一改衬线 600（影响知识库/项目/关于，建议单独一轮看截图） |
| **64** Mono as costume | `projects/[slug].astro` `.tech{font-family:var(--mono)}` 用在标签上 | 本次 polish 去掉；数字/日期/计数保留 mono（gates 本就允许） |
| **75** Text that strains | 文章页 4 处 11px：`.article-toc p`、`a.sub`、`.page-meta`（窄屏）、`.article-pagination span` | 本次统一提到 12px（首页 11-10 已修，这批是上轮未覆盖的文章页） |
| **77 / 79** thin section / dead band | 页头 237px 只有面包屑 + 裸标题；元信息却堆在正文列开头，左右两列起点不对等 | 本次把 `page-meta` + `sub-lines` 收进 `SkyBand`、补 `description` lede、reading padding 68/42 → 52/30（窄屏 32/24 → 28/18） |
| **25** Running prose measure | 720px / 16px ≈ 45–75ch | PASS |
| **71** The crowded head | `.prose h2{margin:2.6em 0 .75em}` | PASS |
| **78** Section heads too small | median h2 19px < 40px | Long Document guard → **N/A** |
| **80 / 84** drawn illustration / fake product | 真实架构图、时序图；首页银河是真实 Three.js 数据渲染 | PASS + 明确豁免（"geometry that is geometry"） |
| **83** The photo wall | 2 张图，远低于页面 1/3 | PASS |
| **3 / 4** Card tells / card in card | 无卡片模板、无嵌套 | PASS |
| **29** Glow and wash | 星空背景 | `design.md` 已 waive（atmospheric genre） |

### Finish（`ANSWERED`，never block）

| Gate | 结果 |
|---|---|
| F3 `text-wrap: balance` | h1/h2 已有 → PASS |
| F21 heading level skipped | h1 → h2，无跳级 → PASS |
| F23 lang / title / description | 三者齐全 → PASS |
| F25 content a phone never gets | 手机 TOC 转 `details`，内容未隐藏 → PASS；本次把折叠条 `margin-bottom 24→12`、`summary padding 12→9`，减轻头重脚轻 |
| F17 text squeezed into sliver | 正文 720px → PASS |
| F15 page invariants | 页头容器 1040 / 768 两级，与列表页一致 → PASS |

### Plain defects（`redesign.md` 明写「任何 depth 都可修」）

> "A finding that is a plain defect (a misalignment, a broken glyph, **a label that lies**) is fixed at any depth."

- **TOC 8 个空链接**：`projects/[slug].astro:16-19` 与 `notes/[...slug].astro:18-22` 都把 `text` 写死成 `''`，`ArticleToc` 直接渲染 → `<a href="#一句话"></a>`。**两处双写是根因**。本次抽 `src/lib/headings.ts` 的 `extractHeadings()` 单一来源修复。
- **摘要卡说谎**：探索态卡片曾写「进入分类 →」但实际执行页内 `flyTo()` —— 11-10 已改为「查看此星团」。
- **图片尺寸**：见 §2，本次修复。

## 4. 建议清单（最轻 depth = **polish**，不动系统与布局骨架）

| 优先级 | 项 | 本轮状态 |
|---|---|---|
| P0 | 修 `34`/`73`：`figure.fig-wide` 不再突破正文列 | ✅ 已改（`global.css` 新增 `article.prose figure.fig-wide`，用更高特异性压住服务器残留规则） |
| P0 | 修 TOC 空链接（plain defect） | ✅ 已改（抽共享模块） |
| P1 | 元信息上移 + `description` lede + 收紧页头 padding | ✅ 已改（两个详情页 + SkyBand） |
| P1 | 标签数量限制（入口 5 / 展示 5+`+N` / topicList 5 / 常量入 `config.ts`） | ✅ 已改 |
| P1 | 文章页 4 处 11px → 12px、`64` 的 `.tech` mono 去掉 | ✅ 已改 |
| 待拍板 | `1` 页头 h1 无衬线 vs `design.md` 锁定的衬线 | ⏸ **未动**，A/B 两案见 §3 |
| waive | `63/67/✦/66/29/20/48/34(overflow-x)` | 📄 已在 `design.md` |
| 不做 | 照搬 Hallmark 改掉中点/tracked-caps、重构银河、动状态机 | ❌ 会破坏 signature |

## 5. 本轮未覆盖 / 已知边界

- 首页列表仍有 3 处 11px（`.note-row .cat`、`.cat-sec h2 .count`、代码复制按钮），
  属 11-10 P0 未覆盖的**首页**小字，不是文章页；若要彻底清零需单独一轮 + 四视口截图。
- 星团摘要卡的 `topicList.slice(0, 5)` 仍是 5（hover 卡片、非页面常驻），本轮未动客户端脚本；
  但 `galaxy-data.ts` 已在生成端截到 5，不会无限增长。
- **入口限制只管新编辑**：线上已有文章的多标签不会自动变少，靠展示端 `+N` 兜底；
  要清历史数据须单独改库内容，未擅自处理。
- **服务器残留 CSS**：线上 `fig-wide` 规则不在本仓库。部署时应把服务器上那段手工样式对齐/删除；
  本地新规则特意写成 `article.prose figure.fig-wide`（特异性 0-2-2 > 0-2-1），即使残留也能压住。
- `description` lede 依赖文章填了 `description`；没填的页面自动不渲染该行（不会留空节点）。

## 6. Waivers（`design.md` 已 on the record）

`63` 中点串与 `✦`、`67` tracked-caps 小标签、`64` 数字用 mono、`66` 银河中心 `scio.`、
`29` atmospheric glow、`20` 无 Hallmark stamp（既有项目不是 Hallmark build）、
`48` 少量字面色、`34` 未声明 `overflow-x: clip`（四视口实测无横向滚动）。
**新增建议**：等 §3 的 `1` 拍板后，把「页头 h1 字体方案」也写进 `design.md`，避免以后每轮审查重复上报。

---

**验收脚本**：`.shots/verify-1112.mjs`（6 个真实渲染 case）、`.shots/audit-fig.mjs`（图片前后对比）、
`.shots/hallmark-render-audit.mjs`（四视口 gate 复查）、`scripts/self-audit.mjs`（46 项）。
*本报告为 audit 结论，不含改造代码。*
