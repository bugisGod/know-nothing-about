// 爬取 SSR 站点关键页 → pagefind 建索引 → 输出 dist/client/pagefind（搜索 UI 零变化）
// 用法: node scripts/build-pagefind.mjs [baseUrl=127.0.0.1:4321]
import { execSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const dir = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] || "http://127.0.0.1:4321";
const dbPath = process.env.SCIO_DB || join(dir, "../admin/data/admin.db");
const db = new DatabaseSync(dbPath, { readOnly: true });

const urls = new Set(["/", "/notes/", "/projects/", "/about/"]);
for (const r of db.prepare("SELECT kind, category, slug FROM posts").all()) {
  urls.add(r.kind === "note" ? `/notes/${r.category}/${encodeURIComponent(r.slug)}/` : `/projects/${encodeURIComponent(r.slug)}/`);
}

const tmp = mkdtempSync(join(tmpdir(), "pf-crawl-"));
// ★ 落盘文件名用序号，不要用 URL 形变（2026-10-20 修）：
//   `/notes/` → `notes/.html` 会写进不存在的子目录 → ENOENT，11 页里 10 页被静默丢弃，
//   索引只剩首页（pagefind 报 "Indexed 1 page"），搜文章标题永远没结果。
let saved = 0;
const failed = [];
const urlsArr = [...urls];
for (let i = 0; i < urlsArr.length; i++) {
  const u = urlsArr[i];
  try {
    const res = await fetch(BASE + u);
    if (!res.ok) { failed.push(`${u} (${res.status})`); continue; }
    const html = await res.text();
    // ★ 按真实路径落盘（目录 mkdir + index.html）：pagefind 用文件相对路径当结果 URL，
    //   若用 p0/p1… 序号文件名，索引里的链接会变成 /p7.html → 点开就 404。
    const rel = u.replace(/^\//, "");
    const file = join(tmp, rel.endsWith("/") || rel === "" ? join(rel, "index.html") : rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, html);
    saved++;
  } catch (e) { failed.push(`${u} (${e.message})`); }
}
if (failed.length) console.error(`[pagefind] ${failed.length} 页抓取失败:`, failed.join(", "));
if (saved === 0) {
  console.error("[pagefind] 一页都没抓到，放弃重建（保留旧索引）");
  rmSync(tmp, { recursive: true, force: true });
  process.exit(1);
}

const out = join(dir, "../dist/client/pagefind");
rmSync(out, { recursive: true, force: true });
execSync(`npx pagefind --site "${tmp}" --output-path "${out}"`, { stdio: "inherit", shell: true });
rmSync(tmp, { recursive: true, force: true });
console.log(`pagefind 索引完成: ${saved}/${urlsArr.length} 页`);
if (saved < urlsArr.length) console.error(`[pagefind] ⚠️ 只索引了 ${saved} 页，站点可能未完全就绪`);
