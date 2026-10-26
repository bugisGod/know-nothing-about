// 一次性归一：把 posts / drafts 里存过大写的 category / slug 统一成小写
//
// ★ 为什么需要（2026-10-26 第二次审查 P2-1）：写入侧已改为进库前小写，但历史库里
//   可能已有 'AI/xxx' 这类 key。UNIQUE(kind,category,slug) 的 category 大小写敏感，
//   混着会让首页长出两个团（哈希不同 → 形状也不同），且 /notes/AI/<slug>/ 会 404。
//   同 slug 大小写各一份时保留 updated_at 最新的那条，其余删除（先整体备份）。
//
// 用法: [SCIO_DB=/path/admin.db] node scripts/normalize-categories.mjs [--dry-run]
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const DRY = process.argv.includes('--dry-run');
const DB_PATH = process.env.SCIO_DB || join(dir, '../admin/data/admin.db');
if (!existsSync(DB_PATH)) { console.error('库文件不存在：' + DB_PATH + '（用 SCIO_DB 指定）'); process.exit(1); }

const bak = DB_PATH + '.pre-normalize.bak';
if (DRY) {
  console.log('[dry-run] 只报告，不改库：' + DB_PATH);
} else {
  copyFileSync(DB_PATH, bak);
  console.log('已备份 → ' + bak);
}
const db = new DatabaseSync(DB_PATH);

const rows = db.prepare(
  "SELECT id, kind, category, slug, title, updated_at FROM posts WHERE category != lower(category) OR slug != lower(slug)"
).all();
console.log(`posts 需归一的行：${rows.length}`);

// 同 (kind, 小写category, 小写slug) 归一后撞 UNIQUE 的，保留 updated_at 最新的一条
const groups = new Map();
for (const r of rows) {
  const key = `${r.kind}|${r.category.toLowerCase()}|${r.slug.toLowerCase()}`;
  const g = groups.get(key) || [];
  g.push(r); groups.set(key, g);
}
let deleted = 0, updated = 0, draftCount = 0;
db.exec('BEGIN');
try {
  for (const [, g] of groups) {
    g.sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    const [keep, ...drop] = g;
    for (const d of drop) {
      if (!DRY) db.prepare('DELETE FROM posts WHERE id=?').run(d.id);
      deleted++;
      console.log(`  - 删除重复行 #${d.id} ${d.category}/${d.slug}（保留 #${keep.id}）`);
    }
    if (keep.category !== keep.category.toLowerCase() || keep.slug !== keep.slug.toLowerCase()) {
      if (!DRY) db.prepare('UPDATE posts SET category=?, slug=? WHERE id=?')
        .run(keep.category.toLowerCase(), keep.slug.toLowerCase(), keep.id);
      updated++;
      console.log(`  ~ 归一 #${keep.id} ${keep.category}/${keep.slug} → ${keep.category.toLowerCase()}/${keep.slug.toLowerCase()}`);
    }
  }
  // 草稿表没有 UNIQUE 约束，直接改
  const ds = db.prepare(
    "SELECT id, category, slug FROM drafts WHERE category != lower(category) OR slug != lower(slug)"
  ).all();
  for (const d of ds) {
    if (!DRY) db.prepare('UPDATE drafts SET category=?, slug=? WHERE id=?')
      .run(d.category.toLowerCase(), d.slug.toLowerCase(), d.id);
  }
  db.exec('COMMIT');
  draftCount = ds.length;
} catch (e) {
  db.exec('ROLLBACK');
  console.error('归一失败，已回滚事务：' + e.message);
  process.exit(1);
}
console.log(`${DRY ? '[dry-run] 将会' : '已'}处理：归一 ${updated} 行、删除重复 ${deleted} 行、草稿 ${draftCount} 行`);
console.log('分类现状：', db.prepare("SELECT DISTINCT category FROM posts WHERE category != ''").all().map(r => r.category).join(' '));
