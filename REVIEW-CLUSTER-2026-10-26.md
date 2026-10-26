# 星团系统专项审查报告 · 2026-10-26

> 范围：`src/lib/galaxy-data.ts`、`src/config.ts`（配色）、`src/components/BrainGraph.astro`（首页银河）、
> `src/components/MiniGalaxy.astro`（知识库/专题页卡片）及三个消费页面。
> 方法：静态代码比对 + 复现两侧算法实算 + **真实构建 + SSR 起服抓页面产物实锤**。
> 构建：`npm run build` 通过（exit 0，SSR 模式）。实测样本：ai×2 篇、frontend×1 篇、projects×1 篇。

---

## 一、四个问题的直接结论

| # | 问题 | 结论 | 说明 |
|---|---|---|---|
| 1 | 星团**根据新增类别自动添加**？ | ✅ **满足** | 三处均为遍历派生，新增分类 = 建文件夹放文章，零改码 |
| 2 | 不同星团**形状不同**？ | ⚠️ **基本满足，但有削弱** | 相似度仅 1.0%，但 16.8% 的团会退化成无结构纯椭圆；且存在 NaN 丢结构 bug |
| 3 | 不同星团**自动配色**？ | ⚠️ **满足，但有边界缺陷** | 无状态哈希分配正确；色板仅 10 色，超量实测撞色；首页/知识库传参不一致 |
| 4 | 知识库标签星团**与主页形状一致**？ | ❌ **参数同源，实际不一致** | 形态参数逐项一致，但**专题页颜色全错** + **NaN 丢星链** + 投影/深度降级 |

---

## 二、逐项证据

### Q1 · 自动添加新分类 —— ✅ 通过

- `galaxy-data.ts:45-72`：遍历 `listNotes()`，`cat = id.split("/")[0]`，`ensureCluster()` 自动建团并计数。
- `BrainGraph.astro:2148-2158`：团心布局 `NC = clusters.length` 自适应，`span` 随团数展宽
  （`NC<=3` 用 0.22，`>3` 时 `min(0.42, 0.22+0.05*(NC-3))`），径向落在 0.5~0.92×GR。
- `notes/index.astro:23-40`：`clusterMap` 按目录自动分组。
- `CATEGORIES` 是**可选覆盖位**（`config.ts:40-44` 注释已声明），不配置也能出团。

**边界隐患（P2）**：`posts.ts:100` 的 id 是 `${category}/${slug}`，若后台建笔记时 category 为空 →
id = `/slug` → `split("/")[0]` = `""` → 团 key 变 `cat:`、`title` 为空字符串，首页出现**无名星团**。

---

### Q2 · 形状区分度 —— ⚠️ 满足但有削弱

形态发生器由团 key 哈希派生（`BrainGraph.astro:2052-2088`）：
FNV-1a(`cat:key`) → LCG，顺序消费 `flat / pa / core / thick / nClumps / clumps[] / nChains / chains[]`。

复现 20000 个虚拟分类统计：

| 形态构成 | 占比 |
|---|---|
| 团块 + 星链 | 34.5% |
| 仅团块 | 27.3% |
| 仅星链 | 21.4% |
| **无内部结构（纯椭圆）** | **16.8%** |
| 随机两团「形态高度相似」 | **1.0%** |

**结论**：区分度总体优秀（相似率 1.0%），但**约每 6 个新分类就有 1 个落到「纯椭圆」**——
`nClumps = floor(rng*2.6)` 与 `nChains = floor(rng*2.3)` 同时为 0 的概率 = 0.385 × 0.435 ≈ 16.8%。
这类团只有 King 基底轮廓，没有团块/星链高光，视觉辨识度明显弱于其他团。

**叠加缺陷**：见 Q4 的 NaN bug —— frontend 团实测在卡片上丢失整条星链珠串。

---

### Q3 · 自动配色 —— ⚠️ 正确但有两个边界缺陷

分配逻辑（`config.ts:127-150`）：按 birth 升序 → 手动色原样保留 → 自动色走
`pickColorFromPalette`（key 哈希定起点 + 已占用跳过 + 色相距离 <20° 跳过 + 兜底取最大距离）。无状态，同输入同输出。

当前实测一致：ai = `#8fc27a`、frontend = `#a892d8`、projects = `#ffc46b`，首页与知识库**一致** ✅

**缺陷 A · 色板耗尽撞色（P1）**：`AUTO_PALETTE` 仅 10 色。构造 12 个自动色分类实测：

```
cat:c10 → #c28fa8   （与 cat:c5 撞色）
cat:c11 → #d98f8f   （与 cat:c4 撞色）
```

根因：兜底分支中 `if (usedHex.has(cand)) continue;` 全部命中 → `bestT` 保持 -1 →
`picked = AUTO_PALETTE[base]` 返回一个**已占用色**。

**缺陷 B · 首页/知识库传参不一致（P1）**：
- `galaxy-data.ts:116`：`assignClusterColors(clusters.map(...))` —— **未传 reserved**
- `notes/index.astro:45-48`：`assignClusterColors(..., [PROJECT_COLOR])` —— **传了 reserved**

后果：当新分类 birth 早于 projects 团时，首页给它取色时 `usedHues` 里还没有琥珀 38°，
可能挑中 `#d9b26b`(36°，与项目团差 2°)；知识库则一开始就避开了。扫描 39 个常见分类名，
**4 个会触发不一致**（命中率 10%）：

| 分类名 | 首页 | 知识库 |
|---|---|---|
| math | `#d9b26b` (38.7°) | `#b8c26b` (66.9°) |
| life | `#d9b26b` | `#b8c26b` |
| python | `#d9b26b` | `#b8c26b` |
| rust | `#d9b26b` | `#b8c26b` |

---

### Q4 · 知识库卡片 vs 首页形状一致性 —— ❌ 参数同源，实际不一致

#### ✅ 一致的部分（已实算验证）

两侧 seed 字符串完全相同（首页 `clusters[k].key`，卡片 `cat:${key}`），均为 `cat:frontend` / `cat:ai`。
复现两侧发生器，参数逐项比对：

```
cat:frontend   flat=0.508 pa=0.004 core=0.327 thick=0.498 clumps=1 chains=1
cat:ai         flat=0.508 pa=2.926 core=0.367 thick=0.655 clumps=2 chains=2
projects       flat=0.251 pa=2.974 core=0.496 thick=0.664 clumps=1 chains=0
```

`flat / pa / core / thick / clumps / chains` **完全一致**，消费顺序一致（`thick` 在卡片侧虽不使用但仍消费，注释已说明）。

#### ❌ 不一致的三处（均已实锤）

**① 专题页颜色全错（P0，最严重）**

`topic/[cat].astro:66`：`const color = Astro.props.color as string;`
但 `getStaticPaths()` 返回的 props 只有 `{ entries, seriesList, loose }` —— **从未传过 color**；
且全站是 SSR 模式（构建日志 4 条 `getStaticPaths() ignored` 警告），动态页根本不走 `getStaticPaths`。

抓取真实页面产物：

| 页面 | `--tc` | 卡片绘制色 vcRgb |
|---|---|---|
| 知识库 · ai | `#8fc27a` ✅ | `[105,221,57]` |
| 知识库 · frontend | `#a892d8` ✅ | `[128,76,240]` |
| **专题页 /notes/topic/ai/** | **`undefined`** ❌ | `[76,121,240]`（默认雾蓝） |
| **专题页 /notes/topic/frontend/** | **`undefined`** ❌ | `[76,121,240]`（**同一个雾蓝**） |

后果：所有专题页星团都是同一个默认雾蓝 `#9db8ff`，与首页/知识库的配色**完全脱节**；
且 `--tc: undefined` 让 `color-mix(in srgb, var(--tc) 28%, ...)` 等 6 处声明失效，整张 banner 配色塌掉。

**② NaN 坐标导致星链丢失（P1）**

`MiniGalaxy.astro:149-151`：
```js
const nBead = Math.round(12 + ch.arc * 16);
for (let i = 0; i < nBead; i++) {
  const al = -ch.arc / 2 + (ch.arc * i) / (nBead - 1);   // ← nBead=1 时除零 → NaN
```
`ch.arc ∈ ±[0.5, 1.05]`，当 `arc ≈ -0.69` 时 `nBead = 1` → 分母 0 → `al = NaN` → `x/y = NaN`
→ `JSON.stringify` 输出 `null`。

实测页面产物：

| 页面 · 卡片 | 总点数 | NaN 坐标点 |
|---|---|---|
| 知识库 · ai | 320 | 0 |
| **知识库 · frontend** | 320 | **1** ❌ |
| 专题页 · ai | 320 | 0 |
| **专题页 · frontend** | 320 | **1** ❌ |

即 frontend 团的星链珠串在卡片上**整条丢失**（首页 BrainGraph 不用 `nBead` 逻辑，链结构完整）→
**同一个团，首页有形、卡片无形**。这直接打破了「形状一致」的承诺。

**③ 投影与深度降级（P2，视觉层面的固有差异）**

| 维度 | 首页 `BrainGraph` | 卡片 `MiniGalaxy` |
|---|---|---|
| 团内布点压扁 | `clusterFrame`：`ey = sin(th)*dr*0.75*(1-flat)`（**额外 ×0.75** 继承银盘倾斜） | `ey0 = sin(th)*rrN*(1-flat)`（**无 0.75**） |
| 深度 z | `clusterZ`：用 `thick`、`clumps[].cz`、`chains[].zA`（真立体） | `zOf`：`0.75 + (1-nrm)*0.25` + 团块高斯，**完全不消费 thick/cz/zA** |
| 卡片尺寸 | — | 知识库 132、专题页 130（差 2px，形状比例不受影响） |

`MiniGalaxy` 注释称 zOf 是「与首页 clusterZ 同构的简化版」，实际并未消费 `thick/cz/zA`，
立体表现与首页不同源。

---

## 三、问题清单（按优先级）

| 级别 | 问题 | 位置 | 影响 |
|---|---|---|---|
| **P0** | 专题页 `color` 恒 undefined，星团全是默认雾蓝，`--tc` 失效 | `topic/[cat].astro:66` | 三处星团配色断裂，banner 配色塌掉 |
| **P1** | `nBead===1` 除零 → NaN 坐标 → 星链珠串丢失 | `MiniGalaxy.astro:151` | 首页有形、卡片无形，形状一致性破功 |
| **P1** | 首页配色未传 `reserved=[PROJECT_COLOR]` | `galaxy-data.ts:116` | 新分类 birth 早于项目团时，首页/知识库异色（10% 命中） |
| **P1** | 色板仅 10 色，耗尽后兜底返回已占用色 | `config.ts:102-112` | >10 个自动色分类必然撞色 |
| **P1** | `npm run build` 不产 pagefind，`deploy.py:23` 校验缺失即 `sys.exit` | `package.json:9` | **部署流程断点**，全站搜索会失效 |
| **P2** | 16.8% 新团无内部结构，退化成纯椭圆 | `BrainGraph.astro:2068,2074` + `MiniGalaxy:75,80` | 形状辨识度不均 |
| **P2** | 卡片不乘 0.75 盘压扁；zOf 不消费 thick/cz/zA | `MiniGalaxy.astro:117,124` | 立体感与首页不同源 |
| **P2** | 空 category → `cat:""` → 无名空星团 | `posts.ts:100` + `galaxy-data.ts:46` | 后台漏填分类时首页出现空团 |
| **P2** | `topic/[cat].astro` 内部双写：getStaticPaths 用 `"未分类"`，SSR 分支用 `""` | 第 10 行 vs 第 50 行 | 兜底路径不一致（当前数据未触发） |
| **P3** | `gid` 变量定义后从未使用（canvas 无 id 属性） | `MiniGalaxy.astro:137` | 死代码 |
| **P3** | `config.ts:79` 注释引用不存在的 `lib/cluster-colors.server.ts` | `config.ts:79` | 注释误导（实际是 `assignClusterColors` 无状态实现） |
| **P3** | three.js 747 kB（gzip 192 kB）未懒加载；页面 HTML 达 260–309 kB | `BrainGraph.astro` | 性能（REVIEW.md #8 已有，仍未修） |

---

## 四、修复建议（参数级，按优先级）

### P0-1 · 专题页颜色

在 `topic/[cat].astro` 组件体内自行算色，不再依赖 props（与 `notes/index.astro` 同款调用）：

```ts
import { CATEGORIES, PROJECT_COLOR, assignClusterColors } from "../../../config";
// 取该分类 birth（最早文章日期），调 assignClusterColors，reserved 传 [PROJECT_COLOR]
const assigned = assignClusterColors(
  [{ key: `cat:${cat}`, color: meta?.color, birth }], [PROJECT_COLOR]
);
const color = assigned[`cat:${cat}`];
```

### P1-1 · NaN 除零（最小改动）

`MiniGalaxy.astro:151` → 保证分母 ≥ 1：

```js
const nBead = Math.max(2, Math.round(12 + ch.arc * 16));
```

### P1-2 · 首页配色传参对齐

`galaxy-data.ts:116` → `assignClusterColors(..., [PROJECT_COLOR])`，与知识库一致。

### P1-3 · 色板耗尽

二选一：① `AUTO_PALETTE` 扩到 18–24 档（色相间隔降到 15–20°，需同步放宽 `dist<20` 阈值）；
② 兜底分支改为「生成同色相不同明度/饱和度的衍生色」而不是复用已占用色。

### P1-4 · 构建接 pagefind

`package.json` build 改为：`astro build && node scripts/build-pagefind.mjs`（后者需 SSR 服务在跑，
建议在 `deploy.py` 前置一步起服 → 建索引 → 停服，或在 CI 里编排）。

### P2 · 形状保底（如需消除 16.8% 纯椭圆）

```js
const nClumps = Math.max(1, Math.floor(rng() * 2.6));
const nChains = Math.max(1, Math.floor(rng() * 2.3));
```

> ⚠️ **必须 BrainGraph 与 MiniGalaxy 同步改**（不改 rng 消费次数即可保持同序）。
> 这条约束也说明：形态逻辑目前是**两处手写重复实现**，靠注释约定「同序消费」维持一致，
> 本质是双写、脆弱。

### 根本改进建议（架构）

把形态发生器抽成共享模块 `src/lib/cluster-morph.ts`，导出
`clusterMorph(key)` / `clusterDensity` / `clusterZ`，由 `BrainGraph` 与 `MiniGalaxy` 共同 import。
**这是消除「形状一致性」类问题复发的治本方案**——当前任何一侧改形态参数而另一侧忘改，
一致性就会静默失效（NaN bug 已是前车之鉴）。

---

## 五、验证方式说明

本次结论基于：
1. 静态比对两侧形态/配色算法源码；
2. Node 复现算法实算（形态分布 20000 次采样、配色 39 个候选名扫描、12 团撞色构造）；
3. `CODEBUDDY_SAFE_DELETE_ENABLED=0 npm run build` 真实构建（通过）；
4. 起 SSR 服务（`SCIO_DB` 指向 `admin/data/admin.db`，端口 4399）抓取首页/知识库/两个专题页 HTML，
   解析 `data-g` payload 与 `--tc` 内联样式实锤。

已确认历史待办 `REVIEW.md` #3（分类名本地化）、#4（专栏名双写）**已修复**。
