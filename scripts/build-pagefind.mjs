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
const norm = (u) => u.replace(/[^a-zA-Z0-9/-]/g, "_");
for (const u of urls) {
  try {
    const res = await fetch(BASE + u);
    if (!res.ok) { console.error("skip", u, res.status); continue; }
    const html = await res.text();
    writeFileSync(join(tmp, norm(u) + ".html"), html);
  } catch (e) { console.error("fail", u, e.message); }
}
const out = join(dir, "../dist/client/pagefind");
rmSync(out, { recursive: true, force: true });
execSync(`npx pagefind --site "${tmp}" --output-path "${out}"`, { stdio: "inherit", shell: true });
rmSync(tmp, { recursive: true, force: true });
console.log("pagefind 索引完成:", urls.size, "页");
