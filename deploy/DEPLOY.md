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
# 全新库：跑一次迁移把 md 里的现有内容入库
SCIO_DB=/var/lib/scio/admin.db node scripts/migrate-content.mjs
chown -R scio:scio /var/lib/scio   # 见第 4 步建用户（或直接 root 跑，略降安全性）
```

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
Environment=SCIO_DB=/var/lib/scio/admin.db
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
curl -s http://127.0.0.1:4321/admin/health   # {"ok":true}
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

## 6. 备份（内容真身 = SQLite 一个文件）

```bash
# crontab -e：每天 4 点备份库（保留 14 天）+ 每周备份上传图片
0 4 * * * sqlite3 /var/lib/scio/admin.db ".backup /var/lib/scio/backup-$(date +\%F).db" && find /var/lib/scio -name "backup-*" -mtime +14 -delete
```

## 7. 日常更新代码（本地 push 后）

```bash
cd /opt/scio/site && git pull
npm ci --no-audit --no-fund && npm run build
systemctl restart scio-site scio-admin
```

## 已知边界

- **发布管线护栏**：SRC_DIR（=代码目录）有未提交改动时发布会被拒绝——服务器上正常
  （部署态干净）；本地开发机绝不要对主仓库跑发布（事故教训）
- 2G 内存：SSR 进程 ~150MB + admin ~50MB，充裕；`npm run build` 峰值 ~1G 也能过
- 浏览器端银河等静态资源走 SSR 服务的 client 目录，Caddy 无需额外静态配置
