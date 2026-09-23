---
title: 把书读进源码：ZCode 六站对照精读
description: 六个站点实地课：把书里的概念逐一落到 ZCode 的真实代码上
date: 2026-09-21
tags: [AI, ZCode]
series: ai-agent-book
---

> 对照对象：`F:\Projects\ZCode`（github.com/zai-org/ZCode 开源仓库，本地已可构建运行）
> 读法：六个站点按依赖顺序排列，每站 = 真实代码节选 → 逐点讲解 → 对应书中概念 → 思考题。所有代码均从本地源码摘录（有删节，标注了文件路径）。

---

## 第 1 站 · ReAct 循环的真实形状：一台 10 相位状态机

`apps/zcode-cli/packages/core/src/agent/turn-state.ts`

```ts
export const TurnPhase = {
  Idle: "idle",
  ProcessingInput: "processing_input",
  AwaitingModelResponse: "awaiting_model_response",
  Streaming: "streaming",
  SchedulingTools: "scheduling_tools",
  ExecutingTools: "executing_tools",
  AggregatingResults: "aggregating_results",
  AwaitingPermission: "awaiting_permission",   // ★ 注意这个相位
  Completing: "completing",
  Error: "error",
} as const;

export function canTransitionTo(current: TurnPhase, next: TurnPhase): boolean {
  const validTransitions: Record<TurnPhase, TurnPhase[]> = {
    [TurnPhase.Idle]: [TurnPhase.ProcessingInput],
    [TurnPhase.ProcessingInput]: [TurnPhase.AwaitingModelResponse, TurnPhase.Completing],
    [TurnPhase.AwaitingModelResponse]: [TurnPhase.Streaming, TurnPhase.Completing, TurnPhase.Error],
    [TurnPhase.Streaming]: [TurnPhase.SchedulingTools, TurnPhase.AggregatingResults,
                             TurnPhase.Completing, TurnPhase.Error],
    [TurnPhase.SchedulingTools]: [TurnPhase.ExecutingTools, TurnPhase.AwaitingPermission, TurnPhase.Error],
    [TurnPhase.ExecutingTools]: [TurnPhase.AggregatingResults, TurnPhase.AwaitingPermission, TurnPhase.Error],
    // ...
  };
}
```

**逐点讲解：**

1. **书里的 5 行伪代码 → 10 个相位**。多出来的相位就是生产环境的答案：`Streaming`（流式输出中崩了怎么办）、`AwaitingPermission`（工具要授权、用户还没点确认）、`AggregatingResults`（并行工具的结果汇总中）。
2. **`AwaitingPermission` 是一等公民相位**——书里说「约束」是 Harness 五要素之一，这里能看到它不是外挂检查，而是**长在循环骨架里**的一个状态：执行可以停在「等授权」，用户点了确认再继续。你在 ZCode 里见过的每个权限弹窗，本质是循环停在这个相位。
3. **`canTransitionTo` 把合法转移写成查表**——非法转移（比如 Idle 直接跳 ExecutingTools）在运行前就被挡住。这回答了教科书不讨论的问题：**工具执行到一半进程崩了，重启后从哪个相位恢复？** 状态机让「执行到哪」成为可持久化、可观测的一等数据（`TurnState` 里带着 `toolCalls`、`pendingPermissions` 的完整状态）。
4. 对照书里伪代码的 `for call in decision.tool_calls`（可并行）→ `SchedulingTools` 相位先把整批调用调度好再进 `ExecutingTools`——批量调度先于执行，并行才有结构。

📖 对应概念：ReAct 循环、约束进入骨架、状态可恢复性。
💭 思考：为什么 `Streaming` 可以直接跳 `SchedulingTools` 或 `AggregatingResults` 两个不同相位？（提示：流式中途就发现了工具调用 vs 流完才发现没有工具调用）

---

## 第 2 站 · 静态前缀的真实构造：一叠 Section，不是一段话

`apps/zcode-cli/packages/core/src/context/builder.ts`

```ts
export class ContextBuilder {
  /**
   * 保留兼容入口。工具说明由 model request 的 tools 字段承载，不再镜像进 system prompt。
   */
  setToolRegistry(_registry: ToolRegistry): this { ... }

  // 系统提示词由这些 Section 组装：
  // buildCliPrefixSection / buildIdentitySection / buildWorkflowActorIdentitySection
  // buildEnvInfoSection / buildGitSystemContextSection / buildSkillsSection
  // buildRequestUserContextSection / buildCurrentDateSection / buildMemorySection
  // buildDesktopContextSection / buildContextManagementSection / ...
}
```

`src/context/sections/skills.ts`（其中一个 Section 的产出结构）：

```ts
export function buildSkillsSection(options): ContextSection | null {
  if (options.outcome.skills.length === 0) return null;
  const content = buildSkillsContent(
    options.outcome.skills,
    options.metadataBudget ?? DEFAULT_SKILL_METADATA_BUDGET,
  );
  return {
    name: "Skills",
    source: "skills",
    injectionTarget: "meta_user",
    cacheHint: "dynamic",          // ★ 缓存提示
    chars: content.length,
    tokens: estimateTokens(content),
    content,
    preview: content.slice(0, 100),
  };
}
```

**逐点讲解：**

1. **系统提示词 = Section 的组合**：身份、环境信息、git 状态、技能清单、当前日期、记忆、桌面上下文……每块独立构建、独立计量（`chars` / `tokens`）。书里说系统提示词是「岗位说明书」——现实里这本说明书是**活页夹**，按会话环境抽页组装。
2. **注释里的演进痕迹**：「工具说明由 tools 字段承载，不再镜像进 system prompt」——工具定义从系统提示词里**搬出去**，正是书里「静态前缀 = 系统提示词 + 工具定义」两分法的 API 现实，也符合「只增不改」：工具追加到轨迹末尾而不回插前缀，保护 KV Cache。
3. **`cacheHint: "dynamic"`**——每个 Section 自带缓存提示，告诉下游这段内容是否稳定。这是书第 2 章「KV Cache 友好设计」的伏笔在数据结构上的体现：**上下文的每个部分都要声明自己的易变性**。
4. `preview: content.slice(0, 100)`——连调试/日志展示都想好了，书里「保持透明」原则的细节落地。

📖 对应概念：上下文五组件、静态前缀、只增不改、（预告第 2 章）KV Cache。
💭 思考：`buildCurrentDateSection` 为什么是独立 Section 而不是写死在身份段里？（提示：日期变了，哪些缓存要作废？）

---

## 第 3 站 · 「约束」的代码长相：一个 Bash 的安检系统

`apps/zcode-cli/packages/core/src/tool/handlers/bash-command-permission-policy.ts`

```ts
const HIGH_RISK_ROOT_COMMANDS = new Set([
  "bash", "chgrp", "chmod", "chown", "cmd", "dd", "fish", "mkfs",
  "mount", "powershell", "pwsh", "rm", "rmdir", "sh", "umount", "zsh",
]);

const WRAPPER_OPTIONS_WITH_VALUES: Readonly<Record<string, ReadonlySet<string>>> = {
  command: new Set(),
  env: new Set(["-C", "-S", "-u", "--argv0", "--chdir", ...]),
  nohup: new Set(),
  sudo: new Set(["-C", "-D", "-R", "-T", "-a", "-c", ...]),
};

const MAX_SUGGESTED_RULES = 5;
```

配合的解析层（`bash-command-parser.ts`）把 `sudo rm -rf /` 这样的复合命令**拆开**：识别出 sudo 是包装器、剥掉它的选项、拿到真正的根命令 rm，再查高危表。

**逐点讲解：**

1. **高危名单的选品逻辑**：`rm`/`rmdir`（不可逆删除）、`dd`/`mkfs`/`mount`（磁盘级破坏）、`chmod`/`chown`（权限改写）、以及 `bash`/`sh`/`powershell` 这些**shell 本身**——放进 shell 等于绕过所有命令级检查。这正是书思考题 Q7 的现实版：风险评级不止「命令级」，还要穿透**包装器**。
2. **`WRAPPER_OPTIONS_WITH_VALUES` 是防绕过的关键**：`sudo --chdir=/ xxd` 这类选项带值，解析器必须知道每个包装器哪些选项吃参数，否则剥壳时会错位。攻击面分析变成了一张**包装器选项表**——「约束」做到极致就是这种枯燥而精确的枚举。
3. **`MAX_SUGGESTED_RULES = 5`**：给用户建议的授权规则上限。为什么限 5？权限规则是给用户看的——超过 5 条没人读，「约束」就退化成「点确认」。**安全机制本身要防呆**（书里的 ACI 原则反过来作用于安全 UI）。
4. 这一个策略文件背后是整个 Bash 家族：`bash-command-parser`（解析）、`bash-command-rule-evaluator`（规则求值）、`bash-semantics`（只读命令判定）、`bash-timeout-policy`、`bash-cwd-policy`、`bash-background-policy`——书里说「简单工具，复杂策略」，这里是实物。

📖 对应概念：约束（默认关闭显式开放）、工具风险评级、防呆设计。
💭 思考：`MAX_SUGGESTED_RULES = 5` 这种「体验约束」和安全性怎么权衡？（提示：第 8 节护栏的「误拒绝」问题）

---

## 第 4 站 · 上下文的两级回收站：compact 与 microcompact

`apps/zcode-cli/packages/core/src/compact/microcompact.ts`

```ts
export const DEFAULT_MICROCOMPACT_KEEP_RECENT_TOOL_RESULTS = 5;
const DEFAULT_MICROCOMPACT_IDLE_THRESHOLD_MINUTES = 60;
export const DEFAULT_MICROCOMPACT_MIN_TOKEN_SAVINGS = 256;
export const DEFAULT_MICROCOMPACT_THRESHOLD_RATIO = 0.9;
const DEFAULT_MICROCOMPACT_THRESHOLD_BUFFER_TOKENS = 2_000;

export const DEFAULT_MICROCOMPACT_COMPACTABLE_TOOLS = [
  "Read", "Bash", "Grep", "Glob", "WebFetch", "WebSearch",
  "Edit", "Write", "ApplyPatch",      // ★ 纠正：写型工具也在名单里
] as const;

export type LocalMicrocompactDecision = {
  reason:
    | "disabled" | "not_triggered" | "no_candidates"
    | "nothing_to_clear" | "below_min_savings" | "applied";
};

export function buildDefaultMicrocompactThreshold(autoCompactThreshold: number): number {
  const ratioThreshold = Math.floor(autoCompactThreshold * DEFAULT_MICROCOMPACT_THRESHOLD_RATIO);
  const bufferThreshold = autoCompactThreshold - DEFAULT_MICROCOMPACT_THRESHOLD_BUFFER_TOKENS;
  return Math.max(0, Math.min(ratioThreshold, bufferThreshold));
}
```

**逐点讲解：**

1. **两级压缩的分工**：全量 `compact`（整体总结重建，代价大）打底，`microcompact` 做日常保洁——只把**老工具结果的正文**替换成 `[Old tool result content cleared]`，调用记录和占位符保留。触发阈值也保守：`min(90% × 全量阈值, 全量阈值 − 2000)`，取两者更小——**宁可少动，别误伤**。
2. **⚠️ 修正一个想当然**（我第一版笔记写错了）：可清名单**包含 Edit/Write/ApplyPatch**。看似违反直觉，实则正确——microcompact 清的是「工具返回的结果正文」（比如 Edit 返回的大段 diff 回显），**不是操作本身**；操作的事实记录（调用+占位）永远在轨迹里。教训：读源码前下的结论要标注「待验证」。
3. **`KEEP_RECENT_TOOL_RESULTS = 5` 是滑动窗口**：最近的工具结果保持原样（当前推理的直接依据），更早的才回收——书里「组件不等价」的动态版：**同一种组件，新旧也不等价**。
4. **`reason` 枚举是防御性工程的教科书**：函数有六种「没干活」的理由（禁用/未触发/无候选/无可清/省不够/已执行）。每次决策都可解释、可审计——书里「保持透明」原则在内部函数上的落地。
5. **`IDLE_THRESHOLD = 60 分钟`**：闲置一小时也做保洁。用户不在时回收，用户回来时窗口已经干净。

📖 对应概念：上下文压缩、组件不等价、只增不改（占位符替换而非删除）、纠正（保守触发）。
💭 思考：为什么阈值取 `min()` 而不是 `max()`？（提示：两个候选阈值分别防什么——频繁触发 / 太晚触发）

---

## 第 5 站 · 渐进式披露的三个硬常数

`apps/zcode-cli/packages/core/src/context/sections/skills.ts`

```ts
const DEFAULT_SKILL_METADATA_BUDGET = 20_000;   // 技能元数据的 token 预算
const MAX_DESCRIPTION_CHARS = 250;              // 单条描述的字符上限
```

配合仓库根 `apps/zcode-cli/skills-lock.json`：

```json
{
  "skills": {
    "vercel-react-best-practices": {
      "source": "vercel-labs/agent-skills",
      "sourceType": "github",
      "skillPath": "skills/react-best-practices/SKILL.md",
      "computedHash": "ca7b0c0e..."
    }
  }
}
```

**逐点讲解：**

1. **250 字符 = 一张卡片的描述上限**：技能清单常驻上下文，每条只有名字 + 一句话描述——描述命中才加载 SKILL.md 全文。我每个会话开头收到的就是这张受预算约束的清单。
2. **20,000 token = 整个技能区的总预算**：技能再多也不能挤占正文——渐进式披露不是「按需加载」一句话，是**两级硬预算**（单条上限 + 总量上限）。
3. **`skills-lock.json` = 技能的供应链管理**：外部技能来自任意 GitHub 仓库，`computedHash` 锁定内容版本。技能是「第三方卡片」，lock 文件和 package-lock 同一思想——**外部输入永远不可隐式信任**（这也是书里护栏「上下文层」的延伸：技能内容也是一种注入面）。

📖 对应概念：渐进式披露、（预告第 3 章）知识库、护栏-上下文层。
💭 思考：如果技能描述写得很差（描述与正文不符），渐进式披露会怎么失败？谁来保证描述质量？

---

## 第 6 站 · 两套编排在同一仓库里并存

- **自主 Agent**：`core/src/agent/`（第 1 站的状态机）——路径动态生成
- **工作流**：`apps/zcode-cli/packages/dynamic-workflow/`——TypeScript 编排脚本，actor 串行执行、journal 记录状态
- **混合形态**：书里「Agent 先把工作流写出来，工作流再去执行」——我（自主 Agent）生成 workflow 脚本，脚本编译执行时退回确定性，journal 只增不改、可重放

**逐点讲解：**

1. 为什么需要工作流？书里的答案在这里具象化：**循环重试不收敛的任务**（比如「改到测试全绿为止」）交给确定性循环，比反复自主决策省 token 且稳定。
2. journal 的只增不改 = 书的第三设计模式；actor 失败后可从 journal 恢复 = 第 1 站「状态可恢复」在不同尺度的重现——**同一个模式在循环级和流程级各出现一次**。
3. 我派 Explore 子代理（不共享上下文，只回传结论）= 「提议者—审核者」模式； SendMessage 让 actor 间通信 = 多 Agent 协作的最小接口。

📖 对应概念：工作流 vs 自主、混合编排、只增不改、提议者—审核者、（预告第 10 章）多 Agent。

---

## 总表：书中概念 → 源码坐标

| 书中概念 | 源码坐标 | 一句话收获 |
| --- | --- | --- |
| Agent = Model + Harness | 仓库结构（provider 薄 / harness 厚） | 公式的物理形状 |
| ReAct 循环 | `agent/turn-state.ts` + `turn-machine.ts` | 伪代码 5 行 → 状态机 10 相位 |
| 静态前缀组装 | `context/builder.ts` + `sections/*` | 系统提示词是活页夹不是一段话 |
| 约束 | `tool/handlers/bash-command-permission-policy.ts` | 高危表 + 包装器剥壳 + 建议上限 |
| 上下文压缩 | `compact/microcompact.ts` | 两级回收、滑动窗口、六种决策理由 |
| 渐进式披露 | `context/sections/skills.ts` + `skills-lock.json` | 250 字符 / 20k 预算 / 哈希锁版本 |
| 空间扩展 | `zcode-cua` + MCP 总线 | 观察/动作空间的插件化 |
| 混合编排 | `dynamic-workflow/` | Agent 写工作流，journal 保状态 |
| 提议者—审核者 | `core/src/subagent/` | 隔离上下文，只看产物 |

## 读完自查（合上文档回答）

1. `AwaitingPermission` 为什么必须是独立相位而不是ExecutingTools 里的一个布尔标志？
2. microcompact 清 Edit/Write 的结果却不破坏「案底」，靠的是什么结构？
3. `MAX_SUGGESTED_RULES = 5` 体现了哪两条原则的冲突与平衡？
4. 我修正过一处自己的错误论断（第 4 站）——这本身就是书中哪个设计模式的实践？

> 最大的学习感受：**书教的是「Agent 怎么想」，源码展示的是「Agent 怎么活着」——两者之间隔着的全是防御性常数、策略文件和状态机。而读源码最重要的收获，是让想当然的结论现出原形。**
