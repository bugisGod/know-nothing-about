// scio 每日数据库体检 + 备份（cron 调用；VACUUM INTO 出一致镜像，integrity 双验）
// 用法: node scripts/db-maintenance.mjs [dbPath]     （默认读 SCIO_DB 或 admin/data/admin.db）
// 退出码非 0 = 有异常（cron 侧可接告警）；输出单行结论便于日志检索
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const DB = process.argv[2] || process.env.SCIO_DB || join(dir, "../admin/data/admin.db");
const BACKUP_DIR = join(dirname(DB), "backups");
const KEEP = 14;

function die(msg) { console.log(`[db-maintenance] ✗ ${msg}`); process.exit(1); }

let db;
try { db = new DatabaseSync(DB); } catch (e) { die(`库打不开: ${e.message}`); }

// ① 源库完整性
let ic;
try { ic = db.prepare("PRAGMA integrity_check(50)").get(); } catch (e) { die(`integrity_check 执行失败: ${e.message}`); }
if (ic?.integrity_check !== "ok") die(`源库完整性异常: ${JSON.stringify(ic)}`);

// ② 备份（VACUUM INTO 原子产出一致镜像——含 WAL 内容，不会拿 到 malformed 半拷贝）
mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");  // 含时分秒：同天多次跑不冲突
const out = join(BACKUP_DIR, `scio-${stamp}.db`);
try { unlinkSync(out); } catch {}  // 同秒重跑：先删旧档（VACUUM INTO 不覆盖已存在文件）
try { db.exec(`VACUUM INTO '${out.replace(/\\/g, "/")}'`); } catch (e) { die(`备份失败: ${e.message}`); }

// ③ 备份镜像回读校验（别等恢复那天才发现备份是坏的）
//   ★ 2026-10-21：除了 integrity_check，还要与源库行数比对——镜像结构完好但内容少几行
//   是真实可能的失败模式，只查完整性查不出来。
let srcPosts;
try { srcPosts = db.prepare("SELECT COUNT(*) c FROM posts").get().c; } catch { srcPosts = null; }
let vdb;
try {
  vdb = new DatabaseSync(out, { readOnly: true });
  const vic = vdb.prepare("PRAGMA integrity_check(50)").get();
  const posts = vdb.prepare("SELECT COUNT(*) c FROM posts").get().c;
  vdb.close();
  if (vic?.integrity_check !== "ok") die(`备份镜像完整性异常: ${JSON.stringify(vic)}`);
  if (srcPosts !== null && posts !== srcPosts) die(`备份内容与源库不一致: 源库 posts=${srcPosts} 镜像 posts=${posts}`);
  var verifyPosts = posts;
} catch (e) { die(`备份镜像打不开: ${e.message}`); }

// ④ WAL 收编（检查点防 WAL 无限膨胀；TRUNCATE 尽力，有并发读者时 RESTART 也行）
try { db.prepare("PRAGMA wal_checkpoint(TRUNCATE)").get(); } catch {}
// 过期锁回收（防异常退出留下死锁）
try { db.prepare("DELETE FROM locks WHERE acquired_at < datetime('now', '-600 seconds')").run(); } catch {}

// ⑤ 轮转保留 KEEP 份（★ 2026-10-21：unlink 包 try/catch——文件被占用时抛未捕获异常
//   会让 cron 收到非零退出码=误告警；删不掉就留着，下次再试，不值得报警）
const backups = readdirSync(BACKUP_DIR).filter((f) => f.startsWith("scio-") && f.endsWith(".db"))
  .map((f) => ({ f, t: statSync(join(BACKUP_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t);
let removed = 0;
for (const old of backups.slice(KEEP)) {
  try { unlinkSync(join(BACKUP_DIR, old.f)); removed++; } catch { /* 占用中，下次轮转再清 */ }
}

db.close();
console.log(`[db-maintenance] ✓ 源库 ok | 备份 ${out} 镜像 ok（posts=${verifyPosts}${srcPosts !== null ? `，与源库一致` : ''}）| WAL 已 checkpoint | 保留 ${Math.min(backups.length, KEEP)} 份${removed ? `，清理 ${removed} 份旧档` : ''}`);
