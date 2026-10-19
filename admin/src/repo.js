// scio 管理后台 · 仓库访问层
// 环境变量（服务器 systemd / 本地测试各给一套）：
//   SCIO_SRC_DIR  站点源码仓库（如 /opt/scio-src；本地测试指向克隆目录）
//   SCIO_WEB_DIR  静态站根（如 /var/www/scio）
//   SCIO_GIT_PUSH 1=发布时 push GitHub（本地测试可不推）
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db } from './db.js';

export const SRC_DIR = process.env.SCIO_SRC_DIR || '';
export const WEB_DIR = process.env.SCIO_WEB_DIR || '';

export function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: SRC_DIR, encoding: 'utf8', ...opts }).trim();
}

// 列出已发布笔记（★ SSR 化：读 posts 表——发布 v2 不再落 md，读文件会漏新文章）
export function listRepoNotes() {
  return db.prepare("SELECT category, slug, title, date FROM posts WHERE kind='note' ORDER BY date DESC").all()
    .map((r) => ({ category: r.category, slug: r.slug.toLowerCase(), title: r.title, date: r.date, rel: `posts:${r.category}/${r.slug}` }));
}
// 取已发布笔记（转入编辑用）：返回 {fm, body} 形状（与 parseMd 输出同构）
export function noteAsDraftData(cat, slug) {
  const row = db.prepare("SELECT * FROM posts WHERE kind='note' AND category=? AND slug=? COLLATE NOCASE").get(cat, slug);
  if (!row) return null;
  return {
    fm: {
      description: row.description || undefined,
      date: row.date,
      tags: JSON.parse(row.tags || '[]'),
      related: JSON.parse(row.related || '[]'),
      pinned: !!row.pinned,
      series: row.series || undefined,
    },
    body: row.content_md,
  };
}

export function noteFileContent(cat, slug) {
  const p = join(SRC_DIR, 'src/content/notes', cat, `${slug}.md`);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}
