# 一键部署：增量上传 dist 到服务器并热更新（配合 deploy.sh 使用）
# - 上传前校验关键构建产物，缺一件就中止（绝不传半成品）
# - 跳过 astro 服务端中间产物（pages/ chunks/ *.mjs），它们不属于静态站
# - 增量上传：远端存在、大小一致、且不比本地旧 → 跳过
import os, sys
import paramiko

INI = os.path.join(os.path.dirname(__file__), 'server.ini')
if not os.path.exists(INI):
    sys.exit('缺少 server.ini（IP= / PWD=），该文件不入库')

cfg = {}
for line in open(INI, encoding='utf-8'):
    if '=' in line:
        k, v = line.strip().split('=', 1)
        cfg[k] = v

HOST, PWD = cfg['IP'], cfg['PWD']
LOCAL_DIST = os.path.join(os.path.dirname(__file__), 'dist')
PORT = cfg.get('PORT', '8123')

# 构建产物完整性校验
for need in ('index.html', 'pagefind/pagefind.js', 'sitemap-index.xml'):
    if not os.path.exists(os.path.join(LOCAL_DIST, need)):
        sys.exit(f'缺少构建产物 {need} —— 请完整执行 npm run build 后再部署')

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, username='root', password=PWD, timeout=20)

def run(cmd):
    stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
    code = stdout.channel.recv_exit_status()
    out = (stdout.read() + stderr.read()).decode().strip()
    return code, out

code, _ = run('mkdir -p /var/www/scio')
if code != 0:
    sys.exit('远端目录创建失败')

sftp = c.open_sftp()

def ensure_dir(path):
    cur = ''
    for p in path.strip('/').split('/'):
        cur += '/' + p
        try:
            sftp.stat(cur)
        except IOError:
            try:
                sftp.mkdir(cur)
            except IOError:
                pass

def is_junk(rel):
    """astro 服务端中间产物，不属于静态站"""
    rel = rel.replace('\\', '/')
    return rel.startswith('pages/') or rel.startswith('chunks/') or rel.endswith('.mjs')

count = skipped = 0
for root, dirs, files in os.walk(LOCAL_DIST):
    rel_dir = os.path.relpath(root, LOCAL_DIST).replace('\\', '/')
    if rel_dir == '.':
        rel_dir = ''
    if is_junk(rel_dir + '/'):
        continue
    remote_root = '/var/www/scio' + root[len(LOCAL_DIST):].replace('\\', '/')
    ensure_dir(remote_root)
    for f in files:
        rel = (rel_dir + '/' + f) if rel_dir else f
        if is_junk(rel):
            continue
        local = os.path.join(root, f)
        rpath = remote_root + '/' + f
        try:
            st = sftp.stat(rpath)
            if st.st_size == os.path.getsize(local) and os.path.getmtime(local) <= st.st_mtime + 5:
                skipped += 1
                continue
        except IOError:
            pass
        sftp.put(local, rpath)
        count += 1
sftp.close()

run('chown -R caddy:caddy /var/www/scio')
code, out = run(f'curl -s -o /dev/null -w "%{{http_code}}" http://127.0.0.1:{PORT}/')
c.close()
print(f'已上传 {count} 个文件，跳过未变更 {skipped} 个；本机自测 HTTP {out}')
print(f'访问：http://{HOST}:{PORT}/')
