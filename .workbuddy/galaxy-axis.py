"""星河形态分析：亮点像素的主成分主轴 = 星河走向。
主轴角度 0°=水平，-30° 左右 = 左下→右上的对角线（目标构图）。
另给质心与分布范围，判断星河是否居中、是否铺开。
"""
import sys
import numpy as np
from PIL import Image

MASKS = [(0, 1440, 0, 80), (240, 1200, 130, 340), (1230, 1440, 260, 360)]


def analyse(path):
    a = np.asarray(Image.open(path).convert("L")).astype(np.float32)
    h, w = a.shape
    for x0, x1, y0, y1 in MASKS:
        a[y0:y1, x0:x1] = 0
    ys, xs = np.nonzero((a >= 26) & (a < 250))
    if xs.size < 100:
        return None
    X = np.stack([xs, ys]).astype(np.float64)
    c = X.mean(1)
    Xc = X - c[:, None]
    cov = Xc @ Xc.T / X.size
    ev, eV = np.linalg.eigh(cov)
    order = np.argsort(ev)[::-1]
    v = eV[:, order[0]]
    ang = np.degrees(np.arctan2(-v[1], v[0]))       # 屏幕 y 向下 → 取负
    elong = np.sqrt(ev[order[0]] / ev[order[1]])     # 主轴/次轴 = 扁平度
    return dict(n=int(xs.size), cx=c[0], cy=c[1], ang=ang, elong=elong,
                sx=np.sqrt(ev[order[0]]), sy=np.sqrt(ev[order[1]]))


for p in sys.argv[1:]:
    r = analyse(p)
    if not r:
        print(f"{p.split('/')[-1]}: 星点太少"); continue
    print(f"{p.split('/')[-1]:20s} 星点 {r['n']:6d}  质心 ({r['cx']:5.0f},{r['cy']:4.0f})  "
          f"主轴 {r['ang']:+6.1f}°  扁平度 {r['elong']:4.2f}  "
          f"展布 {r['sx']:4.0f}×{r['sy']:3.0f}px")
