// scio 管理后台 · 发布管线
// 流程 v2（SSR 即时发布）：加锁 → 写 posts 表（即时生效）→ 搬媒体 → 标签导出 → 重建 pagefind
//      → npm ci（lockfile 变更时）→ build → 原子切换到 WEB_DIR → 记录 publishes
// 输出：NDJSON 流 {t:'log'|'ok'|'err', line?}（编辑器逐行回显）
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { db, DATA_DIR } from './db.js';
import { SRC_DIR, WEB_DIR, git } from './repo.js';
import { buildFrontmatter } from './notes.js';
import { registryJson } from './tags.js';
const { renderMarkdown } = await import('../../src/lib/md.ts');

let running = false;
export function isPublishing() { return running; }

const IS_WIN = process.platform === 'win32';
function run(cmd0, args, cwd, log) {
  // Windows 下 npm 是 npm.cmd（spawnSync 不能直接跑 .cmd）
  const cmd = IS_WIN && cmd0 === 'npm' ? 'npm.cmd' : cmd0;
  log(`$ ${cmd0} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: IS_WIN, env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1400' } });
  if (r.stdout) log(r.stdout.trimEnd());
  if (r.stderr) log(r.stderr.trimEnd());
  if (r.status !== 0) throw new Error(`${cmd} 退出码 ${r.status}`);
  return r.stdout;
}

export function publishStream() {
  // 返回 ReadableStream：发布步骤逐行推送
  const queue = [];
  let push = (chunk) => queue.push(chunk);
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const send = (obj) => controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));
      (async () => {
        const log = (line) => send({ t: 'log', line });
        const pubId = db.prepare("INSERT INTO publishes (trigger) VALUES ('web')").run().lastInsertRowid;
        let logText = '';
        const cap = (s) => { logText += s + '\n'; };
        try {
          if (running) throw new Error('已有发布在进行中');
          running = true;
          log('── scio 发布管线 ──');
          if (!SRC_DIR) throw new Error('SCIO_SRC_DIR 未配置');

          // 1. 同步远端（有远端时）
          // ★ 护栏（事故教训 2026-10-19）：SRC_DIR 有未提交改动 → 拒绝发布
          if (existsSync(join(SRC_DIR, '.git'))) {
            const dirty = git(['status', '--porcelain']);
            if (dirty && process.env.SCIO_ALLOW_DIRTY !== '1') {
              throw new Error('SRC_DIR 有未提交改动，拒绝发布（防误清工作区）。先在 ' + SRC_DIR + ' 提交或清理，或设 SCIO_ALLOW_DIRTY=1 强制');
            }
          }
          if (existsSync(join(SRC_DIR, '.git'))) {
            const remotes = git(['remote']);
            if (remotes) {
              log('· git pull --rebase …');
              // 服务器仓库是一次性镜像（真身在草稿库+远端）——冲突时直接重置到远端，
              // 发布产物（md/图片/tags.json）随后全部由管线从数据库重新生成，零损失
              try {
                run('git', ['pull', '--rebase', '--autostash'], SRC_DIR, (l) => { log(l); cap(l); });
              } catch (e) {
                log(`· rebase 冲突（${String(e.message).split(String.fromCharCode(10))[0]}）→ 重置到远端`);
                try { run('git', ['rebase', '--abort'], SRC_DIR, () => {}); } catch {}
                run('git', ['fetch'], SRC_DIR, log);
                run('git', ['reset', '--hard', 'origin/main'], SRC_DIR, log);
                run('git', ['clean', '-fd'], SRC_DIR, log);
              }
            }
          }

          // 1.5 ★ posts 表快照（真回滚的依据——v2 不再备份 dist，DB 快照即版本）
          const snapshot = db.prepare('SELECT * FROM posts ORDER BY id').all();
          writeFileSync(join(DATA_DIR, `rollback-p${pubId}.json`), JSON.stringify(snapshot));
          db.prepare('DELETE FROM rollback WHERE restored=0').run();
          db.prepare('INSERT INTO rollback (publish_id, rows) VALUES (?,?)').run(pubId, snapshot.length);

          // 2. ★ 直写 posts 表（SSR 即时生效，2026-10-18）：html 预渲染 + UPSERT
          const drafts = db.prepare("SELECT * FROM drafts WHERE kind IN ('note','project')").all();
          let written = 0;
          const upsert = db.prepare(`INSERT INTO posts
            (kind, category, slug, title, description, date, tags, related, pinned, series,
             period, role, tech, status, link, repo, content_md, html)
            VALUES (@kind,@category,@slug,@title,@description,@date,@tags,@related,@pinned,@series,
                    @period,@role,@tech,@status,@link,@repo,@content_md,@html)
            ON CONFLICT(kind, category, slug) DO UPDATE SET
              title=@title, description=@description, date=@date, tags=@tags, related=@related,
              pinned=@pinned, series=@series, period=@period, role=@role, tech=@tech,
              status=@status, link=@link, repo=@repo, content_md=@content_md, html=@html,
              updated_at=datetime('now')`);
          for (const d of drafts) {
            const fm = JSON.parse(d.fm || '{}');
            if (fm.draft) {
              // ★ 下架：勾「隐藏」= 从线上移除（原 v2 只跳过写入，旧行一直在线）
              const del = db.prepare("DELETE FROM posts WHERE kind=? AND category=? AND slug=? COLLATE NOCASE")
                .run(d.kind, d.kind === 'note' ? d.category : '', d.slug);
              if (del.changes > 0) { cap(`- 下架: ${d.category ? d.category + '/' : ''}${d.slug}`); }
              continue;
            }
            if (!d.title || !d.slug || (d.kind === 'note' && !d.category)) continue;
            const html = await renderMarkdown(d.content_md || '');
            const row = {
              kind: d.kind, category: d.kind === 'note' ? d.category : '',
              slug: d.slug.toLowerCase(), title: d.title,
              description: fm.description || '', date: fm.date || new Date().toISOString().slice(0, 10),
              tags: JSON.stringify(fm.tags || []), related: JSON.stringify(fm.related || []),
              pinned: fm.pinned ? 1 : 0, series: fm.series || '',
              period: fm.period || '', role: fm.role || '', tech: JSON.stringify(fm.tech || []),
              status: fm.status || '已完成', link: fm.link || '', repo: fm.repo || '',
              content_md: d.content_md || '', html,
            };
            upsert.run(row);
            db.prepare('UPDATE drafts SET published_path=? WHERE id=?').run(`${row.kind}/${row.category}/${row.slug}`, d.id);
            written++;
            cap(`+ posts: ${row.category ? row.category + '/' : ''}${row.slug}`);
          }
          log(`· 发布 ${written} 篇（写库即时生效）`);

          // 3. 媒体：暂存区 → 仓库 public/images（搬运后清空暂存，图片从此归 git 管）
          const mediaStage = join(DATA_DIR, 'media');
          if (existsSync(mediaStage)) {
            const files = readdirSync(mediaStage).filter((f) => !f.startsWith('.'));
            if (files.length) {
              mkdirSync(join(SRC_DIR, 'public/images'), { recursive: true });
              for (const f of files) {
                cpSync(join(mediaStage, f), join(SRC_DIR, 'public/images', f));
                cap(`+ public/images/${f}`);
              }
              log(`· 搬运图片 ${files.length} 张`);
              // ★ 同步到 SSR 静态根（运行时伺服 dist/client/images——构建期快照不含新图）
              const clientImg = join(SRC_DIR, 'dist/client/images');
              if (existsSync(clientImg)) {
                for (const f of files) cpSync(join(mediaStage, f), join(clientImg, f));
              }
            }
          }

          // 3.5 标签注册表 → src/data/tags.json（站点按显示名渲染）
          const reg = registryJson();
          mkdirSync(join(SRC_DIR, 'src/data'), { recursive: true });
          writeFileSync(join(SRC_DIR, 'src/data/tags.json'), JSON.stringify(reg, null, 2) + String.fromCharCode(10), 'utf8');
          log(`· 标签注册表 ${Object.keys(reg).length} 项`);
          const st = git(['status', '--porcelain']);
          if (st) {
            git(['add', '-A']);
            git(['commit', '-m', `后台发布 ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`]);
            const sha = git(['rev-parse', '--short', 'HEAD']);
            log(`· commit ${sha}`);
            if (process.env.SCIO_GIT_PUSH === '1') {
              log('· push GitHub …');
              run('git', ['push'], SRC_DIR, (l) => { log(l); cap(l); });
            }
          } else {
            log('· 仓库无内容变更，跳过 commit');
          }

          // 5. ★ 搜索索引重建（SSR 无需构建，秒级）——对运行中站点爬页建 pagefind
          log('· 重建搜索索引 …');
          const siteBase = process.env.SCIO_SITE_URL || 'http://127.0.0.1:4321';
          try {
            run(process.execPath, [join(SRC_DIR, 'scripts/build-pagefind.mjs'), siteBase], SRC_DIR, log);
          } catch (e) { log('· 搜索索引重建失败（不影响发布）: ' + e.message); }
          log('· 已上线 ✓（即时生效）');

          db.prepare("UPDATE publishes SET status='ok', log=?, commit_sha=?, finished_at=datetime('now') WHERE id=?")
            .run(logText, git(['rev-parse', '--short', 'HEAD']), pubId);
          send({ t: 'ok' });
        } catch (e) {
          cap(String(e.message || e));
          db.prepare("UPDATE publishes SET status='failed', log=?, finished_at=datetime('now') WHERE id=?").run(logText, pubId);
          send({ t: 'err', line: String(e.message || e) });
        } finally {
          running = false;
        }
      })();
    },
  });
  return stream;
}

// ★ 回滚 v2（SSR）：恢复上一次发布前的 posts 快照（搜索索引由下次发布或手动重建）
export function rollback() {
  const last = db.prepare('SELECT publish_id FROM rollback WHERE restored=0 ORDER BY id DESC LIMIT 1').get();
  if (!last) throw new Error('没有可回滚的快照');
  const file = join(DATA_DIR, `rollback-p${last.publish_id}.json`);
  if (!existsSync(file)) throw new Error('快照文件缺失: ' + file);
  const snapshot = JSON.parse(readFileSync(file, 'utf8'));
  const restore = db.transaction(() => {
    db.prepare('DELETE FROM posts').run();
    const ins = db.prepare(`INSERT INTO posts
      (kind, category, slug, title, description, date, tags, related, pinned, series,
       period, role, tech, status, link, repo, content_md, html, created_at, updated_at)
      VALUES (@kind,@category,@slug,@title,@description,@date,@tags,@related,@pinned,@series,
              @period,@role,@tech,@status,@link,@repo,@content_md,@html,@created_at,@updated_at)`);
    for (const row of snapshot) ins.run(row);
  });
  restore();
  db.prepare('UPDATE rollback SET restored=1 WHERE publish_id=?').run(last.publish_id);
  db.prepare("UPDATE publishes SET status='rolled_back' WHERE status='ok' AND id=?").run(last.publish_id);
  return `已回滚到发布 #${last.publish_id} 之前（${snapshot.length} 篇）`;
}
