#!/usr/bin/env bash
# 一键更新网站：构建 + 上传服务器
set -e
npm run build
python deploy.py
