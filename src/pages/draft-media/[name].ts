// 草稿预览里的暂存图片：只放行合法文件名 + 有效预览 token
import type { APIRoute } from "astro";
import { verifyPreviewToken, findDraftMedia } from "../../lib/draft-preview";

export const GET: APIRoute = async ({ params, url }) => {
  const name = String(params.name ?? "");
  const token = url.searchParams.get("t") ?? "";
  if (!/^[A-Za-z0-9._-]+$/.test(name) || !verifyPreviewToken(token)) {
    return new Response("forbidden", { status: 403 });
  }
  const hit = findDraftMedia(name);
  if (!hit) return new Response("not found", { status: 404 });
  return new Response(hit.data, {
    headers: { "content-type": hit.mime, "cache-control": "no-store" },
  });
};
