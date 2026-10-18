// scio 管理后台 · 数据层
// SQLite 单文件（admin.db）：用户/会话/草稿/标签/媒体/发布历史/统计
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ADMIN_HOME = join(__dirname, '..');
export const DATA_DIR = process.env.SCIO_DATA_DIR || join(ADMIN_HOME, 'data');
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(join(DATA_DIR, 'admin.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL DEFAULT 'note' CHECK (kind IN ('note','project')),
  category TEXT DEFAULT '',
  slug TEXT DEFAULT '',
  title TEXT DEFAULT '',
  fm TEXT DEFAULT '{}',          -- frontmatter JSON（除 title/正文外全部字段）
  content_md TEXT DEFAULT '',
  published_path TEXT DEFAULT '', -- 发布后对应的仓库文件路径（跟踪用）
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tags (
  key TEXT PRIMARY KEY,           -- 文章 frontmatter 里写的 key
  label TEXT NOT NULL,
  desc TEXT DEFAULT '',
  color TEXT DEFAULT '',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  mime TEXT DEFAULT '',
  size INTEGER DEFAULT 0,
  uploaded_at TEXT DEFAULT (datetime('now')),
  used_by TEXT DEFAULT ''         -- 引用它的草稿/文章 slug
);
CREATE TABLE IF NOT EXISTS publishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','ok','failed','rolled_back')),
  commit_sha TEXT DEFAULT '',
  trigger TEXT DEFAULT 'web',
  log TEXT DEFAULT '',
  started_at TEXT DEFAULT (datetime('now')),
  finished_at TEXT
);
CREATE TABLE IF NOT EXISTS analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT DEFAULT (datetime('now')),
  path TEXT NOT NULL,
  ref TEXT DEFAULT '',
  sid TEXT NOT NULL,              -- 日粒度访客哈希（无 cookie）
  ua TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_analytics_ts ON analytics(ts);
CREATE INDEX IF NOT EXISTS idx_analytics_path ON analytics(path);
`);

// ---- 会话 ----
const SESSION_DAYS = 7;
export function createSession(userId) {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400e3).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, expires);
  return { token, expires };
}
export function getSessionUser(token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ?`).get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  return { id: row.id, username: row.username };
}
export function cleanSessions() {
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

// ---- 登录限速（内存即可，单进程）----
const attempts = new Map(); // ip -> { n, first }
export function loginThrottled(ip) {
  const now = Date.now();
  const a = attempts.get(ip);
  if (!a || now - a.first > 60_000) { attempts.set(ip, { n: 0, first: now }); return false; }
  return a.n >= 5;
}
export function recordLoginFail(ip) {
  const a = attempts.get(ip);
  if (a) a.n++;
}
export function clearLoginFails(ip) { attempts.delete(ip); }
