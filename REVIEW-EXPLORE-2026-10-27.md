# 星图探索态交互审查 · 2026-10-27

> 范围：`src/components/BrainGraph.astro`（探索/聚焦状态机 + 标签系统）。
> 方法：静态通读 4488 行组件的状态机与渲染循环 + `scripts/self-audit.mjs` 回归验证。
> 用户反馈三个问题均已定位到代码行级根因。

---

## 一、今日修复回归结果：45/45 全通过

`node scripts/self-audit.mjs` 无失败项，今天那几笔修复是站得住的：

| 验证项 | 结果 |
|---|---|
| 知识库卡配色 = 首页星团配色 | 首页 `#8fc27a` `#a892d8` ↔ 卡 `#8fc27a` `#a892d8` |
| 每个专题页 banner 色 = 首页该团色 | 2 个专题页 ✓（P0 已修） |
| 卡片星链无 NaN 且铺在团尺度上 | 2 张卡 ✓（P1 已修） |
| 星团 key 全小写 + 大写专题页 301 | 3 团 ✓ |
| 未知分类专题页 404（不再渲染空壳） | ✓ |
| sitemap / RSS 绝对地址 | 11 条 / 4 条 ✓ |
| 后台各类页面与发布链路 | ✓ |

---

## 二、三个问题的根因定位

### 问题 1 · 探索态上下两个退出按钮（确认，且有一处重复绑定）

**现状**：探索态同时出现两个指向「退出探索」的入口。

| 位置 | 元素 | 探索态文案 | 绑定行为 |
|---|---|---|---|
| 顶部胶囊 | `#galaxy-focus .gf-back` | 「← 退出探索」 | 3657 行：`if (exploreMode) exitExplore()` |
| 底部胶囊 | `#explore-exit` | 「✦ EXIT EXPLORE」 | 3661 行：`exitExplore(); flyBack();` |

**额外的代码缺陷**：同一个 `.gf-back` 被绑定了**两次** click：

- `3598 行`：`(focusBar.querySelector('.gf-back')).addEventListener('click', flyBack);`
- `3657 行`：`addEventListener('click', () => { if (exploreMode) { exitExplore(); return; } flyBack(); })`

聚焦态点一次会触发两次 `flyBack()`。因 `flyBack` 首行 `if (focusIdx < 0 && focusT <= 0.001) return;` 而幂等，
当前无可见副作用，但属于应当清理的重复绑定。

### 问题 2 · 聚焦态底部按钮「说谎」（确认，逻辑错位）

根因在 `flyTo()` → `exitExplore(true)` 的 `keepUI` 语义：

```js
// 3556-3559
resumeExplore = exploreMode;
if (exploreMode) exitExplore(true);   // keepUI=true：保留探索层 UI 外观
```

`exitExplore(keepUI=true)` 的执行路径（3637-3656）：

```js
exploreMode = false;                  // ← 探索标记已经清掉
if (!keepUI) { /* 隐藏边框/EXIT —— keepUI=true 时跳过 */ }
```

于是聚焦态下：`exploreMode === false`，但 `#explore-exit` 仍带 `.show`、文案仍是「✦ EXIT EXPLORE」。

此刻点击它（3661 行）：

```js
exploreExit.addEventListener('click', () => { exitExplore(); flyBack(); });
//                                             ↑ 首行 if (!exploreMode) return → 直接跳出
//                                                        实际只剩 flyBack() 生效
```

**结论：按钮写着「退出探索」，实际只做「退出聚焦」。**

顺带说明：此时顶部胶囊的 `.gf-back` 文案是「← 返回全景」、行为是 `flyBack()`，反而是**对的**——
矛盾只集中在底部那一颗。

### 问题 3 · 探索态星团没有「悬浮知识」（确认，是缺内容而非缺显示）

先排除一个误解：**探索态的标签其实是显示的，而且显示条件更宽松。**

- `4229-4231`：探索态的静态禁区从 6 个减到 2 个（只剩 `.site-footer` / `.view-switch`），
  hero 文案禁区被解除 —— 注释明确写着「探索态 hero 已整体淡出，其禁区解除」
- `4061`：`clusLabelOp[k] = d * (0.85 + ...)`，探索态无 hover 无聚焦时 `d = 1` → 透明度 0.85，可见

真正的问题是**标签没有内容**。标签 DOM 只有两样东西（3121-3124）：

```js
el.innerHTML = `<span class="cl-name"></span><span class="cl-count"></span>`;
// cl-name  = c.title        （如「前端」）
// cl-count = "03 ARTICLES"  （篇数）
```

而 **`ClusterDef.desc` 一直带着值却从未被星图使用** —— `galaxy-data.ts:54` 里 `desc: meta?.desc`
（如 frontend 的「框架 · 工程化 · 浏览器」）传下来了，标签渲染时没取。
`ClusterDef.topicList`（话题词，如 `Astro / 前端框架 / 知识管理`）也同理闲置。

所以探索态用户看到的是「前端 / 03 ARTICLES」——知道叫什么、有多少，不知道讲什么。

---

## 三、顺带发现的死 UI / 死 CSS

| 类型 | 位置 | 说明 |
|---|---|---|
| 死 UI | `#explore-help`（HTML 85-86 行 + CSS 477-494） | 变量在 `3606` 取得后就**再没被使用过**，`.show` 从不添加 → 那句「拖动浏览 · 滚轮缩放 · 点击星团/恒星查看」**永远不会显示**。真正生效的是 `2691-2694` 另一个动态创建的 `.explore-tip`（显示 3.2 秒）——两套提示重复，一套是死的 |
| 死 CSS | `.galaxy-focus.hidden-for-explore`（CSS 496-499） | 全仓搜索无任何 JS 添加该 class。说明原设计是「探索态隐藏顶部胶囊」，后来改成显示「自由探索」胶囊，规则没清掉 |

---

## 四、改造方案

### 方案 A · 出口收敛到「一个状态一个明确出口」

原则：**每个状态只留一个主出口，且按钮文案必须等于它的真实行为。**

| 状态 | 保留的出口 | 处理 |
|---|---|---|
| 默认态 | 无模式 UI | 不变 |
| 探索态 | **底部** `✦ EXIT EXPLORE` | 顶部胶囊去掉返回按钮，只留「自由探索」+操作引导 |
| 聚焦态 | **顶部** `← 返回全景` | 底部 EXIT 隐藏；另有「点空白处」「Esc」兜底 |

这样底部按钮的行为就是它文案说的那样，聚焦态再也不会出现名不符实的按钮。

统一由渲染循环按状态驱动（避免多处手动 toggle 不同步）：

```js
// 主循环末尾
const showExit = exploreMode && focusIdx < 0;
exploreExit.classList.toggle('show', showExit);
exploreExit.setAttribute('aria-hidden', String(!showExit));
```

并把点击改成显式分派（兜底，防止将来状态不同步时又说谎）：

```js
exploreExit.addEventListener('click', () => {
  if (focusIdx >= 0) { flyBack(); return; }   // 理论上按钮此时已隐藏
  exitExplore();
});
```

### 方案 B · 标签三层渐进信息（探索态核心）

**不是一次性把信息堆上去** —— 那会破坏「深邃 / 干净 / 忌光污染」的调性。改成随接近程度生长：

| 层级 | 触发条件 | 标签内容 |
|---|---|---|
| 第 1 层 | 常态（默认态 & 探索态都显示） | 团名 + `NN ARTICLES` —— 维持现状不变 |
| 第 2 层 | **仅探索态** | 追加一行描述 `cl-desc`（取 `c.desc`） |
| 第 3 层 | 探索态 + 鼠标靠近 / hover | 浮出 2–3 个话题词胶囊（取 `c.topicList`） |

**无 `desc` 时的降级**（新增分类没配 `CATEGORIES` 的情况，这是常态而非异常）：

```
优先级：c.desc  →  topicList 前 3 个话题 → 兜底「NN 篇文章」
```

例如未配置的 `ai` 分类自动得到 `AI · ZCode · 2 篇`，不至于空着。

**为什么这样分**：探索态的语义是「用户主动说想逛逛」，此时他需要知道每个团是什么；
而默认态点团是直接跳转进分类页，不需要在星图上预习。把描述做成探索态专属，
既补上了信息缺口，又不给默认态增加视觉负担。

DOM 与样式要点：

```js
el.innerHTML = `<span class="cl-name"></span><span class="cl-count"></span><span class="cl-desc"></span>`;
// cl-desc 默认 display:none；父级 [data-mode="explore"] 时 display:block
// 字号 11.5px / opacity 0.5（常态）→ hover 提亮到 0.85
// 话题词胶囊随 clusNearT / hovCluster 淡入，不常驻
```

CSS `data-mode` 由主循环写入：`p.L.el.dataset.mode = exploreMode ? 'explore' : 'idle'`。

**标签避让要同步加高**：`lh = el.offsetHeight` 已经是实测值（4265），加了描述行会自动变高，
避让逻辑无需改公式；但多出的高度会增加撞车概率 → 建议描述行仅在 `clusterScreenR(L.k)` 足够大
（团在画面上有一定尺度）时显示，远处小团维持单行。

---

## 五、执行清单（按优先级）

| # | 优先级 | 改动 | 位置 |
|---|---|---|---|
| 1 | **P1** | 底部 EXIT 显隐绑定 `exploreMode && focusIdx < 0`，聚焦态不再显示 | BrainGraph 主循环 + 3637/3661 |
| 2 | **P1** | 探索态顶部胶囊去掉 `.gf-back`（只留模式名+引导），消除双出口 | 3618 附近 + CSS |
| 3 | **P1** | 删除 `.gf-back` 的重复绑定（保留 3657 的分支版，删 3598） | 3598 |
| 4 | **P2** | 标签加 `cl-desc` 行，探索态显示；`desc` 缺失时降级到 `topicList` | 3121 / 4061 附近 + CSS |
| 5 | **P2** | hover/靠近时浮出话题词胶囊（`topicList`） | 标签渲染 + CSS |
| 6 | **P3** | 清理死 UI：删除 `#explore-help` 元素与 CSS，保留动态 `.explore-tip`（二选一即可） | 85-86 / 477-494 / 3606 |
| 7 | **P3** | 删除死 CSS `.galaxy-focus.hidden-for-explore` | 496-499 |

> 改动 1–3 是一次性、低风险的状态收敛；改动 4–5 是纯增量的信息补充，不动任何既有视觉参数。
> 建议先做 1–3（把交互说圆），再做 4–5（把信息补全），每一步都能单独验证。

---

## 六、需要拍板的两个点

1. **探索态顶部胶囊要不要保留？** 建议保留但只当作「模式名牌」（显示「自由探索」+操作引导），
   不放按钮。另一种做法是探索态完全不显示顶部胶囊，只留视口边框 + 底部 EXIT 做模式标识
   （更接近原始方案图）——两种都说得通，看更想要「有说明文字」还是「更空」。

2. **话题词要不要常驻？** 倾向只在 hover/靠近时出现。
   如果常驻，探索态画面会多 2–3 排胶囊，可能与「忌光污染、干净」冲突。
