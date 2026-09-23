---
title: Agent 入门：大脑、眼睛与手脚
description: Agent = LLM + 上下文 + 工具：大脑、眼睛、手脚与 Harness 五要素，附官方配图与 ZCode 源码对照
date: 2026-09-21
tags: [AI, ZCode]
series: ai-agent-book
---

> 书：《深入理解 AI Agent：设计原理与工程实践》 · 第 1 章
> 配图来自书仓库（Apache-2.0）。源码对照见姊妹篇《第一章 × ZCode 源码对照精读》。

## 一、核心公式：Agent = LLM + 上下文 + 工具

**Agent = 大脑 + 眼睛 + 手脚：**

| 直觉 | 组件 | 学术概念 | 一句话 |
| --- | --- | --- | --- |
| 大脑 | LLM | 策略（Policy） | 决定「下一步做什么」的决策内核 |
| 眼睛 | 上下文 | 观察与历史 | 每个决策点能看到的全部信息 |
| 手脚 | 工具 | 观察/行动接口 | 感知或改变外部世界的通道 |

两个容易忽略的限定：加号是工程组件的组合，不是 RL 的形式化定义；公式只描述 Agent 边界之内——Environment 不在公式里，但 Agent ↔ Environment 是闭环交互的两方。

![图 1-1：Agent 与 Environment 的闭环交互，以及 Agent 内部的 Model–Harness 结构](/images/ai-book/fig1-1.svg)

*图 1-1：外层是 Agent 与环境的交互环；内层是 Model（决策）+ Harness（构造上下文、暴露工具、实施约束/验证/纠正）。*

生产形态展开：

> **Agent = Model + Harness**
> **Harness = 上下文管理 + 工具接口 + 约束 + 验证 + 纠正**

书里特别澄清：Harness 是「Agent 边界内、模型之外」的运行与治理层——沙箱的权限机制属于 Harness，沙箱里随行动变化的文件属于 Environment；**物理部署位置不决定归属**。

## 二、最重要的工程判断：扩展眼睛和手脚

> 底层模型固定时，提升 Agent 表现最主要的系统工程手段，就是重新定义或扩展观察空间与动作空间。

案例：Manus 把 Deep Research / Coding / Computer Use 三条线的观察+动作空间取并集；OpenClaw 把接口外推到消息渠道 + 本地 Gateway。通用性很大程度上来自**接口边界的扩大**。

## 三、上下文：五个组成部分

静态前缀（不变）：① 系统提示词 ② 工具定义。
动态轨迹（增长）：③ 用户消息 ④ 模型回复（reasoning + content + tool_calls）⑤ 工具执行结果。

实验 1-1 的消融实验设计——逐个去掉组件，看 Agent 会退化成什么样：

![图 1-3：实验 1-1——上下文消融实验设计](/images/ai-book/fig1-3.svg)

*图 1-3：完整基线 + 四组各缺一个组件的对照。*

三个反直觉发现：
1. 去掉**工具定义** → Agent 不会沉默，会给一份格式工整、语气笃定、数据来自参数记忆的幻觉答案
2. 去掉**工具结果** → 盲目重试直到耗尽迭代预算
3. **「给出了回答」≠「完成了任务」**——上下文残缺的典型失败不是报错，而是毫无破绽的错误答案

## 四、ReAct 循环：想 → 做 → 看

![图 1-4：Agent 轨迹——多币种汇总任务的 ReAct 循环](/images/ai-book/fig1-4.svg)

*图 1-4：一次多币种汇总任务，3 次迭代、4 次工具调用的完整轨迹。*

书的最小骨架：

```python
trajectory = [user_request]
repeat:
    context = stable_prefix + trajectory
    decision = Model(context)
    trajectory.append(decision)
    if decision has no tool call:
        return decision.answer
    for call in decision.tool_calls:        # 独立调用可并行
        validated_call = Harness.validate(call)
        observation = Environment.execute(validated_call)
        trajectory.append(observation)
```

轨迹的价值：可解释、可调试、可分析、可沉淀（进知识库或 RL 训练）。

## 五、Harness 工程：模型之外的竞争力

| 要素 | 职责 | 例子 |
| --- | --- | --- |
| 上下文管理 | 信息要充分 | 系统提示词、知识库、压缩 |
| 工具接口 | 接口要清晰（ACI / 防呆） | MCP、代码解释器 |
| 约束 | 默认关闭、显式开放 | 工具权限分级 |
| 验证 | 只信结构化数据 | Linter、结果校验 |
| 纠正 | 静默重试、熔断、回退人工 | 连续失败自动断电 |

**《苦涩的教训》与 Harness 的节奏**：模型会持续吃掉 Harness（few-shot、JSON 容错、提示词改写都已被内化），但节奏比想象慢——**模型此刻的能力边界，就是 Harness 此刻的价值所在**。

## 六、能力更新的三个层次

![图 1-2：Agent 能力更新的三个层次](/images/ai-book/fig1-2.svg)

*图 1-2：任务内的上下文适应（快、不持久）→ 跨任务的外部产物更新（可控积累）→ 训练周期的参数更新（泛化强、成本高）。*

三条路径不是互斥分类，而是不同时间尺度上的协同机制。

## 七、对照 ZCode 源码

本章概念在 ZCode（github.com/zai-org/ZCode）里的落点：

- ReAct 循环 → `core/src/agent/turn-machine.ts`（10 相位状态机，非 while 循环）
- 上下文压缩 → `core/src/compact/`（全量 compact + microcompact 两级）
- 工具约束 → `core/src/tool/handlers/bash-command-*`（一个 Bash 六个策略文件）
- 技能渐进式披露 → `context/sections/skills.ts`（描述常驻、正文按需）

## 八、思考题（挑了四道）

1. 只能加一项：更强模型 / 更丰富上下文 / 更多工具，选哪个？
2. 「模型即 Agent」越来越自主，为什么 Harness 反而更重要？
3. 除了工具结果缺失，还有什么会让 Agent 死循环？
4. `delete_file` 删普通文件 vs 删系统文件——动态风险评级怎么做？

## 一句话总结

> 模型是大脑，上下文是眼睛，工具是手脚；**模型固定时，能力杠杆在接口；模型商品化后，竞争力在 Harness**。
