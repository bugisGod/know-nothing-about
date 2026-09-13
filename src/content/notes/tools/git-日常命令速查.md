---
title: Git 日常命令速查
description: 只收录真正常用的：撤销、找回、整理提交历史。
date: 2026-09-11
tags: [Git, 工具]
---

## 撤销与找回

```bash
# 撤销工作区某个文件的修改（危险：未提交的改动会丢失）
git restore path/to/file

# 撤销上一次 commit，但保留改动在暂存区
git reset --soft HEAD~1

# 找回误删的分支：先看 reflog 找到 commit 号
git reflog
git checkout -b feature-again <commit>
```

## 暂存现场

```bash
git stash push -m "改了一半的登录页"
git stash list
git stash pop
```

## 整理历史

```bash
# 交互式整理最近 3 个提交（合并、改名、调顺序）
git rebase -i HEAD~3

# 把别的分支上的某一个提交摘过来
git cherry-pick <commit>
```

> 原则：已推送到共享分支的历史不要改写。
