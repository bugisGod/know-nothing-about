# Hallmark audit · scio（2026-11-09）

> 依据 `Nutlope/hallmark` v2.0.0（Anti-AI-slop design skill）的 **`audit <target>`** 流程。
> 该动词按 `references/redesign.md` **停在 Before 阶段**：记录页面 → 看截图 → 四行 read → 走 gates → 出报告，
> 原文明确 `It changes none of the project's files`。**本次未修改任何项目文件**，符合「先不要改」。
> 规则来源与下载情况见 `.shots/hallmark/AUDIT-RULES-USED.md`（完整 zip 三种通道均被代理截断，
> 但 `SKILL.md` / `redesign.md` / `gates.md` 三份核心规则已通过 Web 通道读完）。

---

## 1. The read（Hallmark 要求的四行）

1. **这个页面是干什么的**：个人名片 + 知识库入口；唯一动作是「EXPLORE → 进入星图，点击星团看内容」。
2. **什么好、必须留下**：**银河星图是真正的 signature**——它是可运行、可交互、由真实文章数据驱动的
   Three.js canvas，不是 `gate 80` 说的「画的插画」、也不是 `gate 84` 说的「假产品 UI」。
   首屏一句话 + 一个动作、零虚构指标/证言/logo 墙（`46a` 干净），深邃干净的调性全站一致。
3. **什么读起来像生成的**：**标点和仪表盘式小标签**——满屏中点分隔符、`→` 粘在按钮文字后、
   `02 ARTICLES` / `EXIT EXPLORE` 这类字距拉开的全大写等宽标签、`✦` 装饰符、
   以及一批 10.5px 的小字。这些正好是 Hallmark 的 `63 / 67 / 64 / 75 / 66` 点名的「machine-made tells」。
4. **什么真的坏了**：**装饰层缺 `aria-hidden`**（`NebulaBand.astro:12` 的 canvas + 一个 svg）；
   几层极淡文字（「一片属于你的思想星系」、中央 `scio.` 水印、「太阳系 · 猎户臂」）叠在星图上，
   既压低可读性又让首屏文字层偏多。

---

## 2. 测量结果（真实渲染，不是目测）

脚本 `.shots/hallmark-render-audit.mjs`，四个视口 + 无脚本模式；截图 `.shots/hallmark-1280.png` / `hallmark-1440.png`。

| 检查 | 1280×800 | 1440×900 | 1920×1080 | 375×667 |
|---|---|---|---|---|
| `44b` hero 标题/一句/主动作全在首屏 | ✅ | ✅ | ✅ | ✅ |
| `34` 横向溢出 | ✅ 无 | ✅ 无 | ✅ 无 | ✅ 无 |
| `49a` 按钮/导航换行 | ✅ 无 | ✅ 无 | ✅ 无 | ✅ 无 |
| `40` 抽样文字对比度 <4.5:1 | ✅ 无 | ✅ 无 | ✅ 无 | ✅ 无 |
| `58` 每屏文字量 | 321 字符 | 321 | 321 | 308 |
| `75` <12px 的功能文字 | **13 处** | **13** | **13** | **13** |
| `33` 装饰 canvas/svg 无 aria | **2 个** | **2** | **2** | **2** |

`62` 无脚本：仍有 **201 字符可见**（导航、大标题、署名、EXPLORE、标语、页脚）——核心内容不依赖 JS，
**达标**（星团标签是 JS 动态生成的，canvas 应用本就如此，不算「页面空白」）。

已具备的：`F23` `lang` / `title` / `description` ✅、`F3` `text-wrap: balance` 多处 ✅、
`F16` `::selection` ✅、`26a` 全局 `:focus-visible` ✅、`27` reduced-motion 三处 ✅、
`28a` / `76` 未见破图与自动播放视频、`38i` 标题无「单个斜体词」问题（整句是斜体 display）。

---

## 3. Findings by tier

### Floor（Hallmark 判 `FAIL`，不可豁免）

| Gate | 证据 | 说明 | 本站建议 |
|---|---|---|---|
| **33** 装饰层无 `aria-hidden` | `src/components/NebulaBand.astro:12` `<canvas data-nebula>`；另有一个 `<svg>` | 屏幕阅读器会读到空画布 | **采纳**：加 `aria-hidden="true"`（2 行，零风险） |
| **63** 模板标点 | `src/pages/index.astro:17` `EXPLORE →`、`:25` `每一颗星，都是一篇文章 · 点击星团进入分类`；`BrainGraph.astro:72` `打开分类页 →`、`:91` `阅读全文 →`、`:85` `✦ EXIT EXPLORE`；描述行「框架 · 工程化 · 浏览器」；页脚「© 2026 scio · 苏ICP备…」 | 中点串、粘在文字上的箭头、装饰前缀，Hallmark 的 house rule | **部分采纳**：`→` 可去掉或换成独立图标；中点是你定的「琥珀句点」语言，建议保留并 waive |
| **67** tracked-caps 小标签 | `BrainGraph.astro:401` `.cl-count` `02 ARTICLES`（10.5px + `letter-spacing:.16em` + 大写）；`:85` `EXIT EXPLORE`；`index.astro:16` `— SCIO ME NIHIL SCIRE` | 15px 以下、大写、字距 >0.03em，Hallmark 的 house rule | **建议保留**：这是星图仪表盘的字汇，去掉会削弱「观测感」；在 `design.md` 里 waive |
| **20** CSS 首行无 Hallmark stamp | `src/styles/global.css:1` | Hallmark 自家 build 的记账规则 | **不采纳**：既有项目不是 Hallmark build，补 stamp 无实际收益 |
| **34** html/body 缺 `overflow-x: clip` | 全站无该声明 | 形式缺失（实测 4 视口均无横向滚动） | **可选**：补一句 `clip` 更稳，但当前无缺陷 |
| **48** token 块外仍有字面颜色 | `global.css` 前 80 行之外有 12 行含 `#…/rgba(…)` | 多为阴影/纹理/渐变，不是主题色硬编码 | **不急**：若要彻底，可把高频值收进 `:root` |

### Reflex（`REFLEX`，可「on the record」豁免）

| Gate | 证据 | 建议 |
|---|---|---|
| **75** Text that strains | 13 处 10.5–11px：`gf-back`「← 返回全景」、`gf-open`「打开分类页」、`tip-go`「阅读全文」、探索提示三段、`sky-hint`、页脚「星图 / 列表」「© 2026 scio」「苏ICP备…」 | **采纳**：功能文字统一提到 ≥12px（备案号可留 11px 属法定展示）；这是本次最实在的可访问性改进 |
| **64** Mono as costume | `BrainGraph.astro` 12 处 `font-family: var(--mono)` 用在计数、标签、提示、按钮 | **建议改**：只给真正的数字/代码留 mono，导航与提示改回 body face，AI 味会明显下降 |
| **66** Decoration text | `index.astro:16` `— SCIO ME NIHIL SCIRE`；`BrainGraph.astro:317`「太阳系 · 猎户臂」；中央淡 `scio.` | **建议精简**：破折号前缀可去；中央水印与 hero 文字叠着，建议减一层 |
| **19** Copy tells | 同一处 em dash 前缀 | 顺带处理（其余文案是自家写的，无 buzzword / 虚构数字，干净） |
| **29** Glow and wash | 星图光晕、核球渐变 | **waive**：本站 genre 属 `atmospheric`，gates 允许两个固定 bloom；且光晕来自真实数据渲染的星图，不是装饰模糊球 |
| **42** Chrome by reflex | 左上字标 + 右上四个链接 | **waive**：无 hairline、无右侧按钮，不是典型 AI nav |
| **11 / 3 / 23 / 65 / 74** | 未见同款 hover 抬升、三列图标卡、accent 铺满、奶油纸+陶土色、框架默认色板 | 通过 |

### Finish（不阻断，回答即可）

- `F16` 有 `::selection` 与局部 `scrollbar-color`，**缺 `caret-color`**（搜索框）——顺手补。
- `F23` / `F3` 已达标。`F26`（段落孤字）、`F21`（标题层级跳跃）本次未逐页测，建议纳入下一轮。

---

## 4. 修改建议（按优先级；标注最轻 depth）

Hallmark 的 depth：**polish**（系统与布局不动，只改 gate 点名的元素）就足以覆盖下面全部；
不需要 restyle，更不需要 full redesign——星图这个 signature 本身是对的，别动它。

**P0 · 真问题，建议直接做（polish）**
1. `NebulaBand.astro:12` 与那个 svg 补 `aria-hidden="true"`（`33`）。
2. 功能文字 10.5px → ≥12px：`.gf-back` / `.gf-open` / `.tip-go` / `.explore-tip` / `.sky-hint` / 视图切换（`75`）。
   备案号保持 11px 可接受。
3. 首屏减一层淡字：中央 `scio.` 水印或「一片属于你的思想星系」二选一，避免 hero 文字层叠四层（`66` + 可读性）。

**P1 · 明显降 AI 味，可见改动（polish）**
4. 12 处 `--mono` 收窄到「数字 / 代码」场景，标签与操作提示改回 body face（`64`）。
5. 去掉粘在按钮/链接文字后的 `→`：`EXPLORE`、`打开分类页`、`阅读全文`（`63`）。
   若保留方向感，改成独立图标 + 文字分离。

**P2 · 建议「waive 并记录」，不要照搬**
6. `63` 的中点、`67` 的全大写小标签、`✦` 装饰符、`— SCIO ME NIHIL SCIRE`——
   这些是**你已定的站点调性**（衬线 + 琥珀句点 + 星图仪表盘）。Hallmark 判它们 FAIL 是因为
   它们恰好是生成式页面最爱用的套路，但在本站是有意为之、且全站一致。
   建议新建 `design.md` 写一句 design system 声明，把这些列为 on-the-record waivers，
   以后再做审查就不会反复被报。
7. `20` stamp、`48` 字面颜色：既有项目不必补 stamp；字面色可按收益慢慢收进 `:root`。

**不建议动的**：银河星图、探索/聚焦状态机、配色（银色主导 + 琥珀焦点）、字体主体。
这些是站点的 signature，Hallmark 的 `80/84/47c` 恰恰会因为「画出来的东西」扣分，
但本站是真实渲染，属于规则明确豁免的一类。

---

## 5. 声明与下一步

- **本次未改任何项目文件**；新增的只有 `.shots/` 下的审查脚本、截图与规则说明（均 gitignore）。
- 线上未部署任何本轮内容；本地 4321 服务跑的是 11-09 22:25 那版（含移动端修复 + 关于页文案删除）。
- 若要做，建议按上面 P0 → P1 分两批，每批后用 `.shots/hallmark-render-audit.mjs` + `mobile-check.mjs` 复跑；
  P2 只写 `design.md`，不动代码。
