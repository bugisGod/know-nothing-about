// 访问统计接收端点（自托管 1px gif，无 cookie 无第三方）
//
// ★ 为什么站点自己要有这个路由（2026-10-21 性能实测）：
//   埋点在 Base.astro 里打向 /aa，而 /aa 原本只存在于 admin 服务（4322）。
//   没有反向代理分流时（本地直连、或线上 Caddy 还没改成 reverse_proxy），
//   /aa 会落到站点自身的 404 页——实测 **253KB HTML，每个页面访问都白下载一遍**，
//   既浪费流量又要解析整个 404 页面，是明显的卡顿来源。
//   站点与后台共用同一个 SQLite（WAL），这里直接写 analytics 表，不再依赖分流。
import type { APIRoute } from "astro";
import { createHash } from "node:crypto";
import { db } from "../lib/posts";

export const prerender = false;

const GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

export const GET: APIRoute = ({ request, clientAddress }) => {
  try {
    const url = new URL(request.url);
    const ua = request.headers.get("user-agent") || "";
    const ip =
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      clientAddress ||
      "";
    const day = new Date().toISOString().slice(0, 10);
    const sid = createHash("sha256").update(`${ip}|${ua}|${day}`).digest("hex").slice(0, 16);
    db()
      .prepare("INSERT INTO analytics (path, ref, sid, ua) VALUES (?,?,?,?)")
      .run(
        String(url.searchParams.get("p") || "/").slice(0, 300),
        String(url.searchParams.get("r") || "").slice(0, 300),
        sid,
        ua.slice(0, 180)
      );
  } catch {
    // 统计失败绝不能影响页面
  }
  return new Response(GIF, {
    headers: {
      "content-type": "image/gif",
      "cache-control": "no-store, no-cache, must-revalidate",
      "content-length": String(GIF.length),
    },
  });
};
