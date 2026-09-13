---
title: Astro 内容集合入门
description: 用 Content Collections 让 Markdown 内容拥有类型安全的 frontmatter 与查询 API。
date: 2026-09-12
tags: [Astro, 前端框架, 知识管理]
---

## 为什么用内容集合

内容集合（Content Collections）是 Astro 管理 Markdown 的方式：在一个目录里放 `.md` 文件，用 schema 约定每篇内容的元信息。好处是 frontmatter 写错了会在构建时直接报错，而不是上线后才发现页面缺字段。

## 三步上手

### 1. 定义集合

在 `src/content.config.ts` 中：

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { notes };
```

### 2. 查询内容

```ts
import { getCollection } from 'astro:content';

// 第二个参数是过滤函数，常用来排除草稿
const notes = await getCollection('notes', ({ data }) => !data.draft);
```

### 3. 渲染单篇

```astro
---
const { Content } = await render(entry);
---

<Content />
```

## 小结

- schema 用 zod 写，字段名写错、类型不对，构建即报错
- `draft: true` 可以把半成品藏起来，不影响本地写
- 本站的知识库和项目复盘都是这样驱动的
