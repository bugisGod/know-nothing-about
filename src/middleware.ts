// SSR 中间件：文本响应压缩 + ETag 协商缓存
//
// ★ 为什么需要（2026-10-21 性能实测）：
//   本地直连 node 服务时没有任何压缩——首页 HTML 260KB、three.js 747KB、CSS 262KB
//   全部裸传，单次访问约 1.7MB。生产有 Caddy `encode zstd gzip`，但本地/内网直连
//   没有这一层，观感就是"卡"。这里在应用层补上：
//   ① 按 Accept-Encoding 选 br/gzip（brotli 对小体积更优，阈值以上才压缩）
//   ② HTML 加 ETag + Cache-Control: no-cache —— 重复访问走 304，正文不再重传
//      （SSR 内容会随发布变化，所以是 no-cache 而非长缓存）
import { defineMiddleware } from "astro:middleware";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { createHash } from "node:crypto";

const MIN = 1024; // 小于 1KB 不值得压
const TEXT = /^(text\/|application\/(javascript|json|xml|manifest\+json)|image\/svg\+xml)/;

export const onRequest = defineMiddleware(async (ctx, next) => {
  const res = await next();
  try {
    const url = new URL(ctx.request.url);
    const type = res.headers.get("content-type") || "";
    // 已编码的、非文本的、埋点 gif 一律放过
    if (res.headers.get("content-encoding") || !TEXT.test(type)) return res;
    if (url.pathname === "/aa") return res;

    const buf = Buffer.from(await res.arrayBuffer());
    const headers = new Headers(res.headers);

    // ETag（HTML 才有意义：静态资源已经带 immutable 长缓存）
    if (type.startsWith("text/html")) {
      const etag = `W/"${createHash("sha1").update(buf).digest("base64").slice(0, 16)}"`;
      headers.set("etag", etag);
      headers.set("cache-control", "no-cache");
      if (ctx.request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: { etag, "cache-control": "no-cache" } });
      }
    }

    if (buf.length >= MIN) {
      const accept = ctx.request.headers.get("accept-encoding") || "";
      let body: Buffer | undefined;
      let enc: string | undefined;
      // ★ 只用 gzip（2026-10-21 实测）：brotli 默认质量 11 压 260KB 要 ~1.4s，
      //   TTFB 从 0.2s 劣化到 1.6s，而体积只比 gzip 小 17KB——得不偿失。
      //   生产有 Caddy 的 `encode zstd gzip` 兜底，这里只负责本地/直连场景。
      void brotliCompressSync;
      if (/\bgzip\b/.test(accept)) { body = gzipSync(buf, { level: 6 }); enc = "gzip"; }
      if (body && enc && body.length < buf.length) {
        headers.set("content-encoding", enc);
        headers.set("content-length", String(body.length));
        headers.set("vary", "accept-encoding");
        headers.delete("etag"); // 编码后的字节不同，ETag 不再可比
        return new Response(body, { status: res.status, statusText: res.statusText, headers });
      }
    }
    return new Response(buf, { status: res.status, statusText: res.statusText, headers });
  } catch {
    return res; // 压缩失败就原样返回，绝不因为优化把页面搞挂
  }
});
