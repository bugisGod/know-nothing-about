// 一次性迁移：src/content/**/*.md → posts 表（含 html 预渲染）
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { renderMarkdown } from "../src/lib/md.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// ★ 与 admin/src/db.js、src/lib/posts.ts 统一：SCIO_DB 优先（此前硬编码 admin/data，
//   部署手册里 `SCIO_DB=... node scripts/migrate-content.mjs` 会迁移到错误位置）
const DB_PATH = process.env.SCIO_DB || join(root, "admin/data/admin.db");
mkdirSync(dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','project')),
  category TEXT DEFAULT '',
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  date TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  related TEXT DEFAULT '[]',
  pinned INTEGER DEFAULT 0,
  series TEXT DEFAULT '',
  period TEXT DEFAULT '',
  role TEXT DEFAULT '',
  tech TEXT DEFAULT '[]',
  status TEXT DEFAULT '已完成',
  link TEXT DEFAULT '',
  repo TEXT DEFAULT '',
  content_md TEXT DEFAULT '',
  html TEXT DEFAULT '',
  updated_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(kind, category, slug)
);`);

function parseFm(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return [{}, text];
  const fm = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) v = v.slice(1, -1).split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    else if (v === "true" || v === "false") v = v === "true";
    else v = v.replace(/^['"]|['"]$/g, "");
    fm[kv[1]] = v;
  }
  return [fm, m[2]];
}

const ins = db.prepare(`INSERT OR REPLACE INTO posts
  (kind, category, slug, title, description, date, tags, related, pinned, series,
   period, role, tech, status, link, repo, content_md, html)
  VALUES (@kind, @category, @slug, @title, @description, @date, @tags, @related, @pinned, @series,
          @period, @role, @tech, @status, @link, @repo, @content_md, @html)`);

let n = 0;
for (const kind of ["notes", "projects"]) {
  const dir = join(root, "src/content", kind);
  const handleFile = async (catName, catDir, f) => {
    const slug = f.slice(0, -3);
    const [fm, body] = parseFm(readFileSync(join(catDir, f), "utf8"));
    if (fm.draft === true) { console.log("跳过草稿:", slug); return; }
    const html = await renderMarkdown(body);
    const row = {
      kind: kind === "notes" ? "note" : "project",
      category: kind === "notes" ? catName : "",
      slug: slug.toLowerCase(),
      title: fm.title || slug,
      description: fm.description || "",
      date: (fm.date ? new Date(fm.date) : new Date()).toISOString().slice(0, 10),
      tags: JSON.stringify(fm.tags || []),
      related: JSON.stringify(fm.related || []),
      pinned: fm.pinned === true ? 1 : 0,
      series: fm.series || "",
      period: fm.period || "", role: fm.role || "",
      tech: JSON.stringify(fm.tech || []),
      status: fm.status || "已完成",
      link: fm.link || "", repo: fm.repo || "",
      content_md: body, html,
    };
    ins.run(row);
    n++;
    console.log("入库:", row.kind, row.category ? row.category + "/" + slug : slug);
  };
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.isDirectory()) {
      for (const f of readdirSync(join(dir, ent.name))) {
        if (f.endsWith(".md")) await handleFile(ent.name, join(dir, ent.name), f);
      }
    } else if (ent.name.endsWith(".md")) {
      await handleFile("", dir, ent.name);
    }
  }
}
console.log("完成，共", n, "篇");
