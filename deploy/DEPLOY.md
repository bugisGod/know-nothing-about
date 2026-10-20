# scio SSR 部署手册（服务器操作，等用户批准后执行）

> 前提：服务器 Debian 系、root、Caddy 已装（现状）。两个 Node 常驻服务：
> **scio-site**（SSR 站点，127.0.0.1:4321）+ **scio-admin**（后台，127.0.0.1:4322），
> Caddy 把域名流量分流。数据库一个文件，**必须持久化 + 备份**（内容真身在库里）。

## 1. 装 Node（≥22.18，.ts 直载需要）

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
node -v   # v22.x（≥22.18）
```

## 2. 代码与目录布局

```bash
mkdir -p /opt/scio
cd /opt/scio
git clone https://github.com/bugisGod/know-nothing-about.git site
cd site && npm ci --no-audit --no-fund
npm run build          # 产出 dist/server + dist/client
```

**数据库放代码目录外**（重部署不丢内容）：

```bash
mkdir -p /var/lib/scio
# 全新库：跑一次迁移把 md 里的现有内容入库（脚本已支持 SCIO_DB）
SCIO_DB=/var/lib/scio/admin.db node scripts/migrate-content.mjs
```

> ⚠️ **同一个库文件，三个入口都要指向它**：
> `SCIO_DB` 是站点（`src/lib/posts.ts`）、后台（`admin/src/db.js`）、迁移脚本
> （`scripts/migrate-content.mjs`）**共同认的唯一变量名**。
> 后台另有 `SCIO_DATA_DIR`（媒体暂存区，默认 `admin/data`）；回滚快照固定写在库文件旁边，
> 不需要单独配置。不要只给后台配 `SCIO_DATA_DIR` 而给站点配 `SCIO_DB`——那会变成两个库。

## 3. systemd 两个服务

`/etc/systemd/system/scio-site.service`：

```ini
[Unit]
Description=scio SSR site
After=network.target

[Service]
WorkingDirectory=/opt/scio/site
Environment=SCIO_DB=/var/lib/scio/admin.db
Environment=PORT=4321
Environment=HOST=127.0.0.1
ExecStart=/usr/bin/node /opt/scio/site/scripts/start.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/scio-admin.service`：

```ini
[Unit]
Description=scio admin
After=network.target scio-site.service

[Service]
WorkingDirectory=/opt/scio/site/admin
# SCIO_ADMIN_PASS 首次启动建管理员；改密码：删除 users 表行后重启
EnvironmentFile=/etc/scio/admin.env   # chmod 600，内容见下
Environment=SCIO_DB=/var/lib/scio/admin.db      # ★ 与站点同一个库文件
Environment=SCIO_DATA_DIR=/var/lib/scio/media   # 媒体暂存区（可不设，默认 admin/data）
Environment=SCIO_SRC_DIR=/opt/scio/site
Environment=SCIO_SITE_URL=http://127.0.0.1:4321
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

`/etc/scio/admin.env`（600 权限）：

```
SCIO_ADMIN_PASS=<正式密码，第一次部署时设置>
```

启动：

```bash
systemctl daemon-reload
systemctl enable --now scio-site scio-admin
curl -s http://127.0.0.1:4322/admin/health   # {"ok":true}  ← 后台在 4322，不是 4321
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4321/   # 200
```

**git 身份（发布管线要 commit，没配会导致 SRC_DIR 变脏 → 下次发布被护栏拒绝）**：

```bash
git config --global user.email "scio@nihilscire.com"
git config --global user.name "scio"
git -C /opt/scio/site status --porcelain   # 必须为空，否则发布会被拒绝
```

## 4. Caddy 配置（替换现有静态段）

`/etc/caddy/Caddyfile`：

```
nihilscire.com {
    encode zstd gzip

    # 管理后台 → admin 服务
    handle /admin/* {
        reverse_proxy 127.0.0.1:4322
    }
    handle /admin {
        reverse_proxy 127.0.0.1:4322
    }
    # 统计埋点 → admin 服务
    handle /aa {
        reverse_proxy 127.0.0.1:4322
    }
    # 其余全部 → SSR 站点
    handle {
        reverse_proxy 127.0.0.1:4321
    }
}
```

```bash
caddy validate --config /etc/caddy/Caddyfile && systemctl restart caddy
```

## 5. 验证清单（部署后逐项过）

```bash
curl -s https://nihilscire.com/ | grep -c graph-data        # 银河数据非空
curl -s https://nihilscire.com/notes/ | grep -c 笔记          # 知识库有内容
curl -s -o /dev/null -w "%{http_code}" https://nihilscire.com/admin/login   # 200
# 浏览器：登录后台 → 写一篇测试 → 发布 → 2 秒内线上可见 → 删除/下架 → 确认消失
# 浏览器：搜索页搜任意已发布标题 → 有结果（首次由 start.mjs 兜底建索引）
```

## 6. 备份 + 每日体检（内容真身 = SQLite 一个文件）

⚠️ **不能只 cp admin.db**——WAL 模式下主库+`-wal` 是分离的，只拷主库拿到的是
malformed 半拷贝（实测踩过）。用 `VACUUM INTO`（原子产出含 WAL 的一致镜像），
脚本还带完整性双验（源库 + 备份镜像回读）和 WAL checkpoint：

```bash
# 手动跑一次（输出单行结论，异常退出码非 0）
node /opt/scio/site/scripts/db-maintenance.mjs

# crontab -e：每天 4 点体检+备份（保留 14 份，自动轮转），异常时接你的告警方式
0 4 * * * node /opt/scio/site/scripts/db-maintenance.mjs >> /var/log/scio-maint.log 2>&1 || <告警命令>
```

脚本做五件事：源库 `integrity_check` → `VACUUM INTO` 备份 → **备份镜像回读校验**
（别等恢复那天才发现备份是坏的）→ `wal_checkpoint(TRUNCATE)` → 过期锁回收。

## 6.5 Node 版本纪律（node:sqlite 是 experimental）

启动日志会有 `ExperimentalWarning`——API 有小变动风险。对策：
- **版本钉住**：DEPLOY 里装的是 Node 22.x（`nodesource setup_22.x`），升级 Major 前
  必须在本地先跑 `.shots/self-audit.mjs`（32 项）+ `rollback-proof.mjs`（3 项）回归
- 不换 better-sqlite3：原生模块在升 Node 时要重装编译，部署依赖越少越好（用户定案）
## 7. 日常更新代码（本地 push 后）

```bash
cd /opt/scio/site && git pull
npm ci --no-audit --no-fund && npm run build
systemctl restart scio-site scio-admin
```

## 已知边界

- **发布管线护栏**：SRC_DIR（=代码目录）有未提交改动时发布会被拒绝——服务器上正常
  （部署态干净，见第 3 步 git 身份与 status 检查）；本地开发机绝不要对主仓库跑发布（事故教训）
- 2G 内存：SSR 进程 ~150MB + admin ~50MB，充裕；`npm run build` 峰值 ~1G 也能过
- 浏览器端银河等静态资源走 SSR 服务的 client 目录，Caddy 无需额外静态配置
- **重启不会漏进程**：`scio-site` 用 `scripts/start.mjs` 启动，它会把 SIGTERM/SIGINT
  转发给真正的 SSR 子进程，`systemctl restart` 不会留下占端口的孤儿进程
- 服务以 root 运行（现状）；若要降权，建 `scio` 用户并把 `/var/lib/scio`、`/opt/scio/site`
  属主改掉，再在两个 unit 里加 `User=scio`
