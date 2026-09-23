import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 知识库：子文件夹名 = 分类名，如 src/content/notes/frontend/xxx.md
const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    // 专栏：同系列文章归组（如书名），详情页显示归属与序号
    series: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// 项目复盘：src/content/projects/xxx.md
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    period: z.string().optional(),
    role: z.string().optional(),
    tech: z.array(z.string()).default([]),
    // 用于知识图谱的关联（与笔记共享 tag 即自动连线）
    tags: z.array(z.string()).default([]),
    status: z.enum(['进行中', '已完成', '已归档']).default('已完成'),
    link: z.string().url().optional(),
    repo: z.string().url().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { notes, projects };
