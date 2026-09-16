# 一键部署：上传 dist 到服务器并热更新（配合 deploy.sh 使用）
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

count = 0
for root, dirs, files in os.walk(LOCAL_DIST):
    remote_root = '/var/www/scio' + root[len(LOCAL_DIST):].replace('\\', '/')
    ensure_dir(remote_root)
    for f in files:
        sftp.put(os.path.join(root, f), remote_root + '/' + f)
        count += 1
sftp.close()

run('chown -R caddy:caddy /var/www/scio')
code, out = run(f'curl -s -o /dev/null -w "%{{http_code}}" http://127.0.0.1:{PORT}/')
c.close()
print(f'已上传 {count} 个文件；本机自测 HTTP {out}')
print(f'访问：http://{HOST}:{PORT}/')
