// scio 管理后台 · 仓库访问层
// 环境变量（服务器 systemd / 本地测试各给一套）：
//   SCIO_SRC_DIR  站点源码仓库（如 /opt/scio-src；本地测试指向克隆目录）
//   SCIO_WEB_DIR  静态站根（如 /var/www/scio）
//   SCIO_GIT_PUSH 1=发布时 push GitHub（本地测试可不推）
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const SRC_DIR = process.env.SCIO_SRC_DIR || '';
export const WEB_DIR = process.env.SCIO_WEB_DIR || '';

export function git(args, opts = {}) {
  return execFileSync('git', args, { cwd: SRC_DIR, encoding: 'utf8', ...opts }).trim();
}

// 列出仓库里的全部笔记（分类=目录）
export function listRepoNotes() {
  const root = join(SRC_DIR, 'src/content/notes');
  if (!existsSync(root)) return [];
  const out = [];
  for (const cat of readdirSync(root)) {
    const dir = join(root, cat);
    if (!statSync(dir).isDirectory()) continue;
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.md')) continue;
      const slug = f.slice(0, -3);
      const text = readFileSync(join(dir, f), 'utf8');
      const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const fm = m ? m[1] : '';
      const title = fm.match(/^title:\s*(.+)$/m)?.[1]?.replace(/^['"]|['"]$/g, '') || slug;
      const date = fm.match(/^date:\s*(.+)$/m)?.[1]?.trim() || '';
      const draft = /^draft:\s*true/m.test(fm);
      if (draft) continue;
      out.push({ category: cat, slug, title, date, rel: `src/content/notes/${cat}/${f}` });
    }
  }
  out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return out;
}

export function noteFileContent(cat, slug) {
  const p = join(SRC_DIR, 'src/content/notes', cat, `${slug}.md`);
  if (!existsSync(p)) return null;
  return readFileSync(p, 'utf8');
}
