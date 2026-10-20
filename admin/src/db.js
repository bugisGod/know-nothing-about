// scio 管理后台 · 数据层
// SQLite 单文件（admin.db）：用户/会话/草稿/标签/媒体/发布历史/统计
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ADMIN_HOME = join(__dirname, '..');
export const DATA_DIR = process.env.SCIO_DATA_DIR || join(ADMIN_HOME, 'data');
// ★ SCIO_DB 优先（2026-10-20 修）：后台与站点必须同一个库文件。
//   此前 admin 只认 SCIO_DATA_DIR，而部署手册给 admin 配的是 SCIO_DB → 环境变量被静默忽略，
//   后台写 admin/data/admin.db、站点读 /var/lib/scio/admin.db，发布成功但线上不变。
export const DB_PATH = process.env.SCIO_DB || join(DATA_DIR, 'admin.db');
// 快照/发布留档一律放在库文件旁边（避免 DB 外置、快照留在代码目录 → 重部署后回滚失效）
export const SNAPSHOT_DIR = process.env.SCIO_SNAPSHOT_DIR || dirname(DB_PATH);
mkdirSync(DATA_DIR, { recursive: true });
mkdirSync(dirname(DB_PATH), { recursive: true });
mkdirSync(SNAPSHOT_DIR, { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');

try { db.exec('ALTER TABLE drafts ADD COLUMN published_at TEXT'); } catch {}
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
  published_path TEXT DEFAULT '',
  published_at TEXT, -- 上次成功发布的时间（脏过滤：只发「未发过或发后又改过」的草稿）
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
CREATE TABLE IF NOT EXISTS rollback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  publish_id INTEGER NOT NULL,
  rows INTEGER DEFAULT 0,
  restored INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS locks (
  name TEXT PRIMARY KEY,
  owner TEXT,
  acquired_at TEXT DEFAULT (datetime('now'))
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

// ★ 跨进程互斥锁（2026-10-20 用户评审）：running 变量只防同进程并发；
// systemd 重启残留双实例时两个进程会各跑一遍发布。库级锁 + 过期回收
export function acquireLock(name, owner, ttlSec = 600) {
  // 先清过期锁（持有超过 ttl 视为进程已死）
  db.prepare("DELETE FROM locks WHERE name=? AND acquired_at < datetime('now', ? || ' seconds')").run(name, '-' + ttlSec);
  try {
    db.prepare('INSERT INTO locks (name, owner) VALUES (?,?)').run(name, owner);
    return true; // INSERT 主键冲突 = 别人持有 → 抢不到
  } catch { return false; }
}
export function releaseLock(name, owner) {
  db.prepare('DELETE FROM locks WHERE name=? AND owner=?').run(name, owner);
}
