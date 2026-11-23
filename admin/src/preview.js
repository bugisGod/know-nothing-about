// 草稿真预览 · 后台侧一次性 token 签发（站点侧只读校验）
import { randomBytes } from 'node:crypto';
import { db } from './db.js';

const TTL_MS = 60 * 60 * 1000;

export function createPreviewToken(draftId) {
  const now = new Date();
  try { db.prepare('DELETE FROM preview_tokens WHERE expires_at < ?').run(now.toISOString()); } catch {}
  const token = randomBytes(24).toString('hex');
  db.prepare('INSERT INTO preview_tokens (token, draft_id, expires_at) VALUES (?,?,?)')
    .run(token, Number(draftId), new Date(now.getTime() + TTL_MS).toISOString());
  return token;
}
