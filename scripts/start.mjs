// SSR 站点启动入口：起服务 → 等就绪 → pagefind 索引兜底（干净部署后搜索可用）
// 用法: node scripts/start.mjs   （环境变量 SCIO_DB / PORT 同站点服务）
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4321;
const HOST = process.env.HOST || "127.0.0.1";

const child = spawn(process.execPath, [join(dir, "../dist/server/entry.mjs")], {
  stdio: "inherit",
  env: { ...process.env, PORT, HOST },
});
console.log(`[start] SSR 服务启动中: http://${HOST}:${PORT}`);

// 等站点就绪
async function waitReady(timeoutMs = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/about/`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

const ok = await waitReady();
if (!ok) {
  console.error("[start] 站点未在 30s 内就绪，跳过 pagefind 兜底");
} else if (!existsSync(join(dir, "../dist/client/pagefind/pagefind.js"))) {
  console.log("[start] pagefind 索引缺失（干净部署）→ 重建 …");
  try {
    execSync(`node ${join(dir, "build-pagefind.mjs")} http://127.0.0.1:${PORT}`, { stdio: "inherit" });
  } catch (e) {
    console.error("[start] pagefind 兜底失败（不影响站点）:", e.message);
  }
} else {
  console.log("[start] pagefind 索引已存在，跳过兜底");
}

// ★ 信号转发（2026-10-20 修）：systemd stop/restart 只给父进程发 SIGTERM，
//   spawn 出来的 SSR 子进程收不到 → 变成孤儿继续占着端口，重启必 EADDRINUSE。
let exiting = false;
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => {
    if (exiting) return;
    exiting = true;
    try { child.kill(sig); } catch { /* 子进程已退出 */ }
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
child.on("exit", (code, sig) => process.exit(code ?? (sig ? 1 : 0)));
