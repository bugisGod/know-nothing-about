# -*- coding: utf-8 -*-
"""银河星系形态预览：不用构建整站，直接按同一套布点逻辑离屏渲染，快速比对形态。
输出 .shots/galaxy-preview-<ts>.png（2x2 宫格）。"""
import numpy as np
from PIL import Image

W, H = 720, 450          # 每格尺寸（整张 1440x900）
BG = np.array([0.027, 0.031, 0.055])   # #07080e 页面底色
FOV = 45.0
F = (H / 2) / np.tan(np.radians(FOV / 2))


def gauss(n, seed):
    rng = np.random.default_rng(seed)
    return rng.standard_normal(n), rng.random(n), rng


def build(seed, N, R, arms, sweep, spread, thick, tilt_deg, rz_deg, dist, cyshift):
    """返回 (XYZ, RGB, SIZE)：盘面局部坐标 -> 倾斜 -> 对角线 -> 世界坐标"""
    g, u, _ = gauss(N, seed)
    g2, u2, rng = gauss(N, seed + 991)

    # 半径分布：向中心集中（指数盘）
    r = (u ** 0.72) * R
    # 旋臂骨架：对数螺旋 θ = 分支基角 + sweep * (r/R)；抖动随半径增大
    branch = rng.integers(0, arms, N)
    th = branch * (2 * np.pi / arms) + sweep * (r / R) + g2 * (spread * (0.35 + 0.9 * r / R))
    rr = r + g * (spread * R * (0.25 + 0.75 * r / R))
    x = np.cos(th) * rr
    y = np.sin(th) * rr
    # 厚度：中心鼓包 + 外盘薄
    bulge = np.exp(-(rr / (R * 0.22)) ** 1.4)
    z = g2 * thick * (0.22 + 3.0 * bulge)

    # 核球（独立一批，暖色）
    nb = int(N * 0.20)
    rb = np.abs(rng.standard_normal(nb)) * R * 0.15
    tb = rng.random(nb) * 2 * np.pi
    xb = np.cos(tb) * rb
    yb = np.sin(tb) * rb * 0.85
    zb = rng.standard_normal(nb) * R * 0.055
    x = np.concatenate([x, xb])
    y = np.concatenate([y, yb])
    z = np.concatenate([z, zb])
    is_bulge = np.concatenate([np.zeros(N, bool), np.ones(nb, bool)])

    # 颜色：核球暖黄，盘外冷蓝白
    rr_all = np.sqrt(x * x + y * y) / R
    warm = np.clip(1.0 - rr_all * 1.5, 0, 1) * (np.random.default_rng(seed + 5).random(x.size) * 0.5 + 0.5)
    cCool = np.array([0.84, 0.87, 0.94])
    cWarm = np.array([1.00, 0.85, 0.63])
    col = cCool * (1 - warm)[:, None] + cWarm * warm[:, None]
    col[is_bulge] = cCool * 0.35 + cWarm * 0.65

    # 粒度幂律（同 shader aSize）
    size = 0.35 + 0.65 * np.power(np.random.default_rng(seed + 77).random(x.size), 3)
    size[is_bulge] *= 0.7

    # 刚性自转 + 倾斜 + 对角线
    t = np.radians(tilt_deg)
    rz = np.radians(rz_deg)
    # tilt 绕 X
    y1, z1 = y * np.cos(t) - z * np.sin(t), y * np.sin(t) + z * np.cos(t)
    # rz 绕 Z（屏幕内）
    x2 = x * np.cos(rz) - y1 * np.sin(rz)
    y2 = x * np.sin(rz) + y1 * np.cos(rz)
    Z = z1 - dist
    return x2, y2 + cyshift, Z, col, size


def render(tile, title):
    img = np.zeros((H, W, 3), np.float32)
    img[:] = BG
    # 背景微星
    rng = np.random.default_rng(11)
    bx = rng.random(260) * W
    by = rng.random(260) * H
    bs = rng.random(260) * 0.9 + 0.4
    for i in range(260):
        splat(img, bx[i], by[i], bs[i], np.array([0.88, 0.90, 0.94]), 0.30)

    x, y, Z, col, size = build(*tile)
    depth = -Z
    sx = F * x / depth + W / 2
    sy = -F * y / depth + H / 2
    ok = (depth > 1) & (sx > -20) & (sx < W + 20) & (sy > -20) & (sy < H + 20)
    sx, sy, col, size, depth = sx[ok], sy[ok], col[ok], size[ok], depth[ok]
    # 近大远小 + 近亮远暗
    persp = (dist_ref / depth)
    bright = np.clip(persp ** 1.15, 0.25, 2.2)
    for i in range(sx.size):
        splat(img, sx[i], sy[i], max(0.42, 1.05 * persp[i] * size[i]), col[i], 0.5 * bright[i] * (0.45 + 0.55 * size[i]))
    return img


def splat(img, cx, cy, sigma, col, amp):
    if amp <= 0:
        return
    r = int(max(1, np.ceil(sigma * 2.2)))
    x0, x1 = int(cx) - r, int(cx) + r + 1
    y0, y1 = int(cy) - r, int(cy) + r + 1
    if x1 <= 0 or y1 <= 0 or x0 >= img.shape[1] or y0 >= img.shape[0]:
        return
    ax0, ay0 = max(0, x0), max(0, y0)
    ax1, ay1 = min(img.shape[1], x1), min(img.shape[0], y1)
    yy = np.arange(ay0, ay1) - cy
    xx = np.arange(ax0, ax1) - cx
    g = np.exp(-(xx[None, :] ** 2 + yy[:, None] ** 2) / (2 * sigma * sigma))
    g = g[:, :, None] * (amp * col[None, None, :])
    img[ay0:ay1, ax0:ax1] += g


dist_ref = 41.6
N_dust, N_arm = 11000, 3000
R_disk = 22.0
D = 41.6

variants = [
    ("A  双臂 · 松散 · 正视 58°", (7, N_dust, R_disk, 2, 3.1, 0.075, 1.5, 58, -32, D, 2.5)),
    ("B  双臂 · 缠绕 · 正视 58°", (7, N_dust, R_disk, 2, 4.6, 0.070, 1.5, 58, -32, D, 2.5)),
    ("C  四臂 · 松散 · 正视 58°", (7, N_dust, R_disk, 4, 3.1, 0.055, 1.5, 58, -32, D, 2.5)),
    ("D  双臂 · 松散 · 侧视 70°", (7, N_dust, R_disk, 2, 3.1, 0.075, 1.5, 70, -32, D, 2.5)),
]

tiles = []
for name, t in variants:
    tiles.append((name, np.clip(render(t, name), 0, 1)))

canvas = np.ones((H * 2 + 30, W * 2 + 30, 3), np.float32) * BG
for i, (name, img) in enumerate(tiles):
    r, c = divmod(i, 2)
    y, x = r * (H + 10) + 10, c * (W + 10) + 10
    canvas[y:y + H, x:x + W] = img
    # 标题条（上沿留白处写字由 PIL 后处理，这里只留深色条避免压图）
    canvas[y - 10:y, x:x + W] = BG * 2.2

out = Image.fromarray((np.clip(canvas, 0, 1) ** (1 / 1.15) * 255).astype(np.uint8))
p = 'F:/Projects/know-nothing-about/.shots/galaxy-preview.png'
out.save(p)
print('saved', p, out.size)
