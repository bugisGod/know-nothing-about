---
title: 魔改 ZCode
description: 给开源 Coding Agent 换星空壁纸的补丁之旅：一行主题 CSS、一个上游 bug 修复、和三次环境踩坑。
date: 2026-09-21
period: "2026.09.21"
role: 补丁作者
tech: [ZCode, Electron, CSS, pnpm]
status: 已完成
tags: [AI, ZCode, 前端]
repo: https://github.com/zai-org/ZCode
---

![ZCode Dev 跑着我的壁纸补丁](/images/zcode-dev-wallpaper.jpg)

## 背景与目标

ZCode 开源了。我想验证两件事：一是我天天在用的工具能不能按自己的审美定制（换背景）；二是借这个机会读一读生产级 Coding Agent 的源码——正好配合《深入理解 AI Agent》第一章的学习。

## 做了什么

三件事，难度递进：

1. **换主题色**：顺着 `useTheme.ts → class 挂载 → CSS 令牌` 的链路，把暗色主题的 `--color-background` 从 `#161616` 改成自己网站的星空蓝黑 `#0b0c12`。一行核心改动。
2. **换壁纸**：颜色不过瘾，又把一张壁纸做成整窗背景——难点是 `body` 被强制透明（毛玻璃需要），最终方案是 `#root::before` 全屏伪元素层 + 面板改半透明（`color-mix` 86%→70%）+ 渐变压暗层，热更新即时见效。
3. **修上游 bug**：构建失败，追到 `cua-bridge.ts` 里一个过时的 `@modelcontextprotocol/sdk/types.js` import——上游依赖已迁移到 server/client 2.0.0 但这行没跟上。改为从新包根路径导入类型，构建即通。

## 踩坑记录（每个都是教训）

| 坑 | 现象 | 教训 |
| --- | --- | --- |
| 覆盖了 `.npmrc` | 配镜像时覆盖仓库自带配置，丢了 `node-linker=hoisted`，构建时 zod 解析不到 | 改任何配置文件前先看它是否存在、里面有什么 |
| 端口占用 | 残留的 vite/electron 进程占着 5174/9229，新进程起不来 | 长跑的开发服务器要配好清理逻辑；排查先 `netstat` |
| 吞输出的管道 | `pnpm dev | tail` 让日志攒到进程结束才吐，监控全盲 | 观察长进程要直写文件，别接缓冲管道 |

## 验证方法

不信肉眼，连 CDP（9229 调试端口）读运行中的计算样式：

```json
{ "themeClass": "dark theme-zai-dark", "backgroundVar": "color-mix(in oklab, #0b0c12 70%, transparent)" }
```

补丁生效与否，由 DOM 说了算。

## 与书的呼应

这次实践正好覆盖《深入理解 AI Agent》第一章的多个概念：状态机化的 ReAct 循环（`turn-state.ts`）、约束的代码长相（Bash 权限策略文件）、上下文的两级压缩（`microcompact.ts`）。完整对照见我的读书笔记。

## 经验沉淀

- 开源 ≠ 每件事都值得改：换背景用**开发模式**（`pnpm dev:desktop`，独立 userData 零风险）就是正确姿势，构建替换正式版才需要背维护债
- 读源码最大的收获是让想当然现出原形：我曾断言「Edit/Write 的结果永不被压缩」，深读后发现它们就在 microcompact 白名单里——清的是结果正文，保留调用记录
- 生产级 Agent 仓库的功力藏在边角：`architecture-policy.yaml`（架构规则进 CI）、`skills-lock.json`（技能供应链哈希锁定）
