"""星野分布量化（排除 UI 干扰）。截图为视口 1440×900 的 1:1 图。
首页 .night 高度 100svh → 页脚落在首屏之外，故底部全是星空，不予排除。
排除的只有：页头、居中的 hero 名言块、右上的「星图/列表」。
"""
import sys
import numpy as np
from PIL import Image

MASKS = [
    (0, 1440, 0, 80),        # 页头
    (240, 1200, 130, 340),   # hero 名言 + 署名
    (1230, 1440, 260, 360),  # 星图/列表 切换器
]


def stats(path):
    a = np.asarray(Image.open(path).convert("L")).astype(np.float32)
    h, w = a.shape
    keep = np.ones_like(a, dtype=bool)
    for x0, x1, y0, y1 in MASKS:
        keep[y0:y1, x0:x1] = False
    sky = np.where(keep, a, 0.0)

    bh = h // 6
    bands, means = [], []
    for i in range(6):
        seg = sky[i * bh:(i + 1) * bh]
        bands.append(int(((seg >= 26) & (seg < 250)).sum()))  # 暗背景下肉眼可辨的星
        v = seg[seg > 0]
        means.append(float(v.mean()) if v.size else 0.0)
    n = int(keep.sum())
    return bands, means, float(sky[sky > 0].mean()), (sky >= 45).sum() / n * 100


for p in sys.argv[1:]:
    bands, means, mean, lit = stats(p)
    tot = max(sum(bands), 1)
    print(f"== {p.split('/')[-1]}  星空均值 {mean:5.2f}  亮点密度 {lit:5.3f}%")
    print(f"   六带亮点 {bands}")
    print(f"   占比     {[f'{b/tot*100:5.1f}%' for b in bands]}")
    print(f"   带均值   {[f'{m:5.2f}' for m in means]}")
