// 站点侧内容数据层：posts 表（SQLite，与 admin 共库 WAL 双进程）
// 形状对齐原 astro:content 条目（id/slug/collection/data），页面模板改动最小化
import { DatabaseSync } from "node:sqlite";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
// ★ 库路径解析（2026-10-20 修）：构建产物里 __dirname = dist/server/chunks，
//   "../../admin/data/admin.db" 会落到 dist/admin/...（目录不存在）→ node:sqlite 直接
//   "unable to open database file"，首页 500。现在：SCIO_DB 优先 → 其次源码树路径 →
//   其次 CWD 路径 → 取第一个已存在的；都不存在则用源码树路径并自动建目录。
function resolveDb(): string {
  if (process.env.SCIO_DB) return process.env.SCIO_DB;
  const cands = [
    join(__dirname, "../../admin/data/admin.db"), // 源码树（src/lib 下）
    join(process.cwd(), "admin/data/admin.db"),   // 从仓库根启动
  ];
  return cands.find((p) => existsSync(p)) || cands[0];
}
export const DB_PATH = resolveDb();

let _db: any = null;
export function db() {
  if (!_db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    _db = new DatabaseSync(DB_PATH);
    _db.exec("PRAGMA journal_mode = WAL;");
    _db.exec("PRAGMA busy_timeout = 5000;");
    ensurePosts(_db);
    // ★ 历史库清理（2026-10-20 实测事故）：早期建的库残留 FTS5 虚表+触发器（代码已删 DDL
    //   但 CREATE IF NOT EXISTS 不会拆已有实体）——回滚 DELETE 时触发器写腐坏的影子表
    //   → "database disk image is malformed"。打开时自动拆除
    _db.exec('DROP TRIGGER IF EXISTS posts_ai');
    _db.exec('DROP TRIGGER IF EXISTS posts_ad');
    _db.exec('DROP TRIGGER IF EXISTS posts_au');
    _db.exec('DROP TABLE IF EXISTS posts_fts');
    // ★ 空库告警（部署静默空站的防线——DB 没上服务器时页面全空但 HTTP 200）
    const n = _db.prepare('SELECT COUNT(*) c FROM posts').get().c;
    if (n === 0) console.error('[posts] ⚠️ posts 表为空——站点将无内容。若刚部署：检查 SCIO_DB 路径 / 跑 scripts/migrate-content.mjs / 从后台发布一次');
  }
  return _db;
}

function ensurePosts(d: any) {
  d.exec(`
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
);
CREATE INDEX IF NOT EXISTS idx_posts_kind ON posts(kind);
CREATE INDEX IF NOT EXISTS idx_posts_series ON posts(series);
`);
}

export interface NoteEntry {
  id: string; slug: string; collection: "notes";
  data: {
    title: string; description?: string; date?: Date; tags: string[];
    related?: string[]; pinned: boolean; draft: boolean; series?: string;
  };
  html: string; content_md: string;
}
export interface ProjectEntry {
  id: string; slug: string; collection: "projects";
  data: {
    title: string; description: string; date: Date; period?: string; role?: string;
    tech: string[]; tags: string[]; status: "进行中" | "已完成" | "已归档";
    link?: string; repo?: string; draft: boolean;
  };
  html: string;
}

const J = (s: string) => { try { return JSON.parse(s || "[]"); } catch { return []; } };
const D = (s: string) => (s ? new Date(s + (s.length === 10 ? "T00:00:00Z" : "")) : undefined);

function toNote(r: any): NoteEntry {
  return {
    id: `${r.category}/${r.slug.toLowerCase()}`, slug: r.slug.toLowerCase(), collection: "notes",
    data: {
      title: r.title,
      description: r.description || undefined,
      date: D(r.date),
      tags: J(r.tags),
      related: J(r.related).length ? J(r.related) : undefined,
      pinned: !!r.pinned, draft: false,
      series: r.series || undefined,
    },
    html: r.html, content_md: r.content_md,
  };
}
function toProject(r: any): ProjectEntry {
  return {
    id: r.slug.toLowerCase(), slug: r.slug.toLowerCase(), collection: "projects",
    data: {
      title: r.title, description: r.description, date: D(r.date) || new Date(),
      period: r.period || undefined, role: r.role || undefined,
      tech: J(r.tech), tags: J(r.tags),
      status: (r.status || "已完成") as any,
      link: r.link || undefined, repo: r.repo || undefined, draft: false,
    },
    html: r.html,
  };
}

export function listNotes(category?: string): NoteEntry[] {
  // ★ 复刻 Astro 内容层行为（视觉零变化实测基线）：按标题排序 + 小写 slug id/URL
  const rows = category
    ? db().prepare("SELECT * FROM posts WHERE kind='note' AND category=? ORDER BY date DESC").all(category)
    : db().prepare("SELECT * FROM posts WHERE kind='note' ORDER BY title").all();
  return rows.map(toNote);
}
export function getNote(id: string): NoteEntry | undefined {
  const [cat, ...rest] = id.split("/");
  const slug = rest.join("/");
  const r = db().prepare("SELECT * FROM posts WHERE kind='note' AND category=? AND slug=? COLLATE NOCASE").get(cat, slug);
  return r ? toNote(r) : undefined;
}
export function listProjects(): ProjectEntry[] {
  return db().prepare("SELECT * FROM posts WHERE kind='project' ORDER BY date DESC").all().map(toProject);
}
export function getProject(slug: string): ProjectEntry | undefined {
  const r = db().prepare("SELECT * FROM posts WHERE kind='project' AND slug=? COLLATE NOCASE").get(slug);
  return r ? toProject(r) : undefined;
}
