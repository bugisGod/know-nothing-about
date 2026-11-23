// 草稿真预览 · 站点侧工具
// 后台与站点共库，预览 token 存在 SQLite；站点只读，不 import admin 模块（避免 Hono 打进站点 bundle）
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "./posts";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** token 必须与草稿 id 匹配（图片路由只需 token 有效，不传 draftId） */
export function verifyPreviewToken(token: string, draftId?: number): boolean {
  if (!/^[a-f0-9]{32,64}$/.test(token)) return false;
  try {
    const row = db()
      .prepare("SELECT draft_id, expires_at FROM preview_tokens WHERE token=?")
      .get(token) as { draft_id: number; expires_at: string } | undefined;
    if (!row) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;
    if (draftId != null && Number(row.draft_id) !== draftId) return false;
    return true;
  } catch {
    return false; // 表还没建 / DB 不可用：一律拒绝
  }
}

/** 图片暂存区：优先环境变量，其次源码树 / 构建产物相对位置 */
export function draftMediaDir(): string | undefined {
  const cands = [
    process.env.SCIO_MEDIA_DIR,
    process.env.SCIO_DATA_DIR ? join(process.env.SCIO_DATA_DIR, "media") : undefined,
    join(__dirname, "../../admin/data/media"), // 源码树 src/lib
    join(__dirname, "../../../admin/data/media"), // dist/server/chunks
    join(process.cwd(), "admin/data/media"),
  ].filter(Boolean) as string[];
  return cands.find((p) => existsSync(p));
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
};

export function findDraftMedia(name: string): { data: Buffer; mime: string } | undefined {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) return undefined;
  const dir = draftMediaDir();
  if (!dir) return undefined;
  const file = join(dir, name);
  if (!existsSync(file)) return undefined;
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return { data: readFileSync(file), mime: MIME[ext] ?? "application/octet-stream" };
}

/**
 * 正文里 /images/<name> 指向发布后的静态根；草稿刚上传的图还在暂存区。
 * 只在预览 HTML 里重写，发布管线写进 posts.html 的仍是原始 /images 路径。
 */
export function rewriteDraftMedia(html: string, token: string): string {
  return html.replace(
    /src="\/images\/([A-Za-z0-9._-]+)"/g,
    (_m, name: string) => `src="/draft-media/${name}?t=${token}"`,
  );
}
