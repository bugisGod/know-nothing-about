"""判定画面里是否存在「环」：以画面中心为原点，统计不同半径上的平均亮度。
环的特征 = 中心低 → 某半径出现峰 → 再向外衰减。实心盘 = 中心即峰。

注意：矩形化地 mask 掉 hero 会制造假峰（mask 矩形边界本身就是一个等距轮廓），
所以这里只剔除「亮得像文字」的像素(>190)，星野一概保留。
用法: python ring-profile.py <png> [png2 ...]
"""
import sys
import numpy as np
from PIL import Image


def profile(path):
    im = Image.open(path).convert("L")
    W, H = im.size
    a = np.asarray(im).astype(np.float32)

    # 页头与页面底部 UI（非星）
    a[0:86, :] = 0
    a[int(H * 0.88):, :] = 0
    # 文字/UI 高亮像素：星星的核很少到这个量级且占比极低，剔除后可忽略对均值的影响
    a = np.where(a > 190, 0.0, a)

    yy, xx = np.mgrid[0:H, 0:W]
    cy, cx = H / 2, W / 2
    r = np.hypot((yy - cy), (xx - cx) * (cy / cx) * 0 + (xx - cx))  # 各向同性径向
    rmax = min(W, H) / 2
    bins, step = 22, rmax / 22
    vals = np.array([
        a[(r >= i * step) & (r < (i + 1) * step)].mean() if ((r >= i * step) & (r < (i + 1) * step)).any() else 0.0
        for i in range(bins)
    ])
    peak = int(vals.argmax())
    print(f"\n=== {path.split('/')[-1]}  ({W}x{H}) ===")
    print(f"  峰值半径 {int(peak*step)}~{int((peak+1)*step)}px / 最大 {int(rmax)}px")
    print(f"  中心 {vals[:2].mean():5.2f} | 峰值 {vals.max():5.2f} | 最外 {vals[-1]:5.2f}")
    print(f"  峰/心 = {vals.max()/max(vals[:2].mean(),0.01):5.2f}   (>1.5 强环, 1.1~1.5 弱环, <1.1 盘/饼)")
    lo, hi = vals.min(), vals.max()
    for i, v in enumerate(vals):
        print(f"   r={int(i*step):3d} {v:5.2f} |{'#' * int((v-lo)/max(hi-lo,1e-6)*44)}")


for p in sys.argv[1:]:
    profile(p)
