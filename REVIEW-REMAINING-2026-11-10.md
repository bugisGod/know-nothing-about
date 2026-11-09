# 剩余优化点清单 · 2026-11-10 01:45

> 在 Hallmark P0/P1 落地后做的补充审查。重点查了两个之前没测过的角度：
> **键盘可访问性**、**手机真实触摸事件链**（此前所有移动端测试都用模拟 `PointerEvent`，
> 且 `pointerType:'mouse'`，恰好绕过了触摸分支）。脚本：`.shots/audit-extra.mjs`、
> `.shots/diag-touch.mjs`、`.shots/diag-tap2.mjs`。

## 一、本轮新发现（2 项，都值得修）

### ① 隐藏控件仍占据 Tab 顺序（a11y，实锤）

首页按 Tab 14 次，第 7/8/9 个焦点落在**默认态完全看不见**的控件上：

```
 1 A.logo | scio .      2 A. 知识库   3 A. 项目   4 A. 关于   5 A. 搜索
 6 BUTTON.explore | EXPLORE
 7 BUTTON.gf-back | ← 返回全景      ← 隐藏的聚焦信息条
 8 A.gf-open | 打开分类页            ← 隐藏的聚焦信息条
 9 BUTTON.explore-exit | ✦ EXIT EXPLORE ← 隐藏的探索出口
10 BUTTON. 星图   11 BUTTON. 列表   12-14 页脚链接
```

根因：全站隐藏只用 `opacity: 0` + `aria-hidden="true"` + `pointer-events: none`，
**没有 `visibility: hidden` 或 `inert`**（`BrainGraph.astro` 全文件 0 处）。
`aria-hidden` 只影响辅助技术读取，**不影响 Tab 可聚焦性**——键盘用户会停在看不见的元素上。

- 建议修法（推荐）：在现有 5 处 `setAttribute('aria-hidden', ...)` 旁同步设 `element.inert = true/false`，
  一处语义、同时管住聚焦与辅助技术；比 CSS `visibility` 更不容易破坏淡入淡出动画。
- 备选：`.galaxy-focus:not(.show)` / `.explore-exit:not(.show)` 加 `visibility: hidden`，
  但要用 `transition: opacity .5s, visibility 0s linear .5s` 才能保留淡出。

### ② 移动端两段式点击：功能正常，但提示与按钮文案不对

真实 `touchStart/touchEnd` 事件链诊断（375×667）：

| | 事件链 | 结果 |
|---|---|---|
| 真实鼠标 | `pointermove → pointerdown → click` | 一次点击即聚焦（`name=ai`, 列表 2 条） |
| 真实触摸 | `pointerdown(touch) → touchstart/touchend → mouseup → click` | 第 1 次只弹摘要卡；**第 2 次点同一目标**才聚焦 |

根因在 `BrainGraph.astro:3704` 的 `pointerup`：`e.pointerType === 'mouse'` 分支命中即 `flyTo()`；
非鼠标分支是有意的「首点预览 → 再点进入」两段式（防误触）。**不是 bug**，但有两个可发现性问题：

1. 一次性操作引导只写「点击星团 / 恒星查看」，没说要**再点一次**；第一次弹出的卡片也没有「再点进入」的提示。
2. **卡片按钮说谎**：探索态摘要卡上的「进入分类 →」实际执行 `flyTo(hitIdx)`（页内拉近聚焦），
   并不是进入分类页（`BrainGraph.astro:3757` 的 tip click handler 里 `if (exploreMode) { flyTo(hitIdx); return; }`）。
   这与之前修掉的「写着 EXIT EXPLORE 却只退聚焦」是同一类问题。

- 建议：探索态把该按钮文案改成「查看此星团 / 拉近查看」，默认态才保留「进入分类」；
  引导语补一句「点一下看简介，再点进入」。顺带这颗 `→` 也是 Hallmark 63 的 glued arrow。

## 二、按收益排序的剩余清单

| 级别 | 项 | 判断 |
|---|---|---|
| **最实际** | **两轮改动都还没上线**：线上 `BOEGS_oN.js`、本地 `B-Qp_Bs2.js`。按 `DEPLOY.md` 需服务器 `git pull + npm run build + restart` 双服务 | 代码改得再多，不部署等于没有 |
| **建议修** | ① inert ② 卡片文案 + 引导语 | 都是小改动、真实影响体验；改完跑键盘 Tab + 两次 touch 验证 |
| **性能债** | 字体 **207 个 woff2 / 6.8MB**，`dist/client` **18MB**；`three.module` **732KB**（已动态 `import()`，别再重复报「懒加载」） | 最大体积项，可只保留用到的子集；收益明确但工作量大，单独做 |
| **架构债** | P2-9 形态/配色逻辑双写（BrainGraph vs MiniGalaxy），抽 `src/lib/cluster-morph.ts` | 自审已有值级断言兜着，风险可控，继续缓做没问题 |
| **取舍** | 390/360 手机只有 `ai` 一条描述（可改统一阈值让三个团同进同退）；手机星团偏小、四周偏空（相机/密度调校） | 需你拍板，属视觉偏好不是缺陷 |
| **取舍** | pagefind 只索引 4 页详情页（首页/知识库/关于/列表页搜不到） | 设计如此（搜文章内容），要不要扩由你定 |
| **文档** | Hallmark P2：写 `design.md` 记录 63/67/✦/stamp 的 on-the-record waive；顺手补 `caret-color`（F16） | 防止以后审查反复报同样的「问题」 |
| **低危风险** | `/aa` 埋点**无速率限制**，任意人可刷 `analytics`（虽有 180 天保留）。**更正**：admin 登录已有 `loginThrottled` / `recordLoginFail`，无此问题 | 个人站可接受，知道即可 |
| **收尾** | 本地 3 个常驻服务（4321/4322/4400）+ 备份分支 `backup/pre-push-2026-11-09` | 用完清理 |

## 三、不建议做

- 照搬 Hallmark 的 63 中点串 / 67 tracked caps 教条改掉站点调性——那是你定的设计语言，写 waive 即可
- 重构银河渲染、换主题、动刚稳定的探索/聚焦状态机
- 为了「优化」而加新功能

## 四、当前状态

- P0/P1 改动**未提交**（6 个修改文件 + `2026-11-10.md` 日志），线上未部署
- 已验证：构建通过 / self-audit 46/46 / 五阶段 13/13 / 移动端四视口与 375 真实点击 /
  Hallmark render 复查 75=0、33=0
- 本轮补充审查**未改动任何代码**

---

## 五、实施记录（2026-11-10 01:52，用户「按优先级完成修改，打开服务验收」）

按清单优先级做完**低风险且收益明确**的 5 项；高风险/需单独一轮的按其自身建议跳过。

### 已做

1. **键盘 a11y（`inert`）**：新增 `setLayerHidden(el, hidden)`，同时维护 `aria-hidden` 与 `inert`；
   9 处 toggle 全部替换，初始化时给 `focusBar` / `exploreExit` / `listPanel` 设 `inert`。
   默认态 Tab 第 7/8/9 不再落在隐藏控件上；探索态显示的 EXIT 仍可 Tab 到达。
2. **摘要卡文案与两段式引导**：
   - 修掉上轮 P1 的遗漏——`showTip()` 运行时又写回了 `阅读全文 →` / `进入分类 →`，现在去掉箭头；
   - 探索态星团卡按钮由「进入分类 →」改为 **`查看此星团`**（与实际 `flyTo()` 一致），
     core 卡保持「进入分类」（它确实跳分类页）；tip click handler 注释同步更新；
   - 一次性引导第三段改为 **`点一下看简介 · 再点进入`**，`.explore-tip` gap 26→16px 防窄屏溢出。
3. **描述行统一阈值**：窄屏改用 `narrowDescW`（所有 `.cl-desc` 中最宽的一条，构建标签后算一次）
   作共同门槛，三个团同进同退。实测 390/360 全收、768 仍全部显示。
4. **`caret-color`（F16）**：`global.css` body 加 `caret-color: var(--accent)`，实测 `rgb(217,184,121)`。
5. **`design.md`**：根目录新建锁定设计系统说明，含 8 项 on-the-record waivers
   （63 中点 / 67 tracked caps / 64 数字 mono / 66 装饰文字 / 29 光晕 / 20 stamp / 48 字面色 / 34 溢出），
   以及可访问性与「不要动」约定。以后 Hallmark 类审查 pre-flight 会先读它，不再反复报同一批。

批量替换用 `.shots/apply-remaining.py` 按字节执行、19 处全部命中，自动识别 CRLF/LF，无行尾漂移。

### 验证（`.shots/verify-remaining.mjs` 专项 + 常规回归）

```
专项  默认态 Tab 不含隐藏控件 ✅  caret-color 琥珀 ✅  隐藏层 inert=true ✅
      探索态 EXIT 可 Tab ✅
      真实 touch：引导含「再点进入」✅ 首点卡片「查看此星团」且无 → ✅ 再点聚焦 ✅
      描述行 390/360 全收 ✅  768 全显示 ✅
常规  构建通过 / self-audit 46/46 / 五阶段 13/13
      移动端四视口无溢出、文章行命中、375 真实点击成功进文章页
      Hallmark render：75=0 / 33=0 / 无溢出·换行·对比度问题
```

### 按建议跳过（不是遗漏）

- **线上部署**：服务器操作需你批准，且本次要本地验收；线上仍是 `BOEGS_oN.js`。
- **字体瘦身 / three.js 体积**：单独一轮，避免和交互修复混在一起。
- **P2-9 morph 共享模块**：双写重构风险高，自审已有值级断言兜着。
- **相机/密度调校（手机星团偏小）**：属视觉取舍，需先截四视口基准再调；
  且团变大会让描述行重新出现，应与统一阈值一起定。
- **pagefind 扩索引 / `/aa` 限流**：前者设计如此，后者个人站低危（admin 登录已有限流）。
- **清常驻服务/备份分支**：本次要开服务验收，保留。

**代码未提交、线上未部署**；本地 4321 / 4322 / 4400 已用新构建 `CFN3bxiz.js` 重启。
