"""星点密度 ASCII 图 —— 只计入「看得见的星点」像素(26~249)，按格子统计占比。
比平均亮度可靠：对稀疏小点敏感，不被大片暗晕糊平。
UI 区域不置零（置零会制造假轮廓），改用 ` 之外单独标注。
用法: python sky-heatmap.py <png> [...]
"""
import sys
import numpy as np
from PIL import Image

RAMP = " .:-=+*#%@"
# hero 文字/UI 所在矩形(x0,x1,y0,y1)，仅用于提示，不参与计算
UI = [(0, 1440, 0, 80), (1230, 1440, 260, 360)]


def heat(path, cols=78, rows=30):
    a = np.asarray(Image.open(path).convert("L")).astype(np.float32)
    h, w = a.shape
    lit = ((a >= 26) & (a < 249)).astype(np.float32)
    cw, ch = w / cols, h / rows
    grid = np.array([
        [lit[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)].mean()
         for c in range(cols)]
        for r in range(rows)
    ])
    lo, hi = np.percentile(grid, 40), np.percentile(grid, 98.5)
    out = []
    for r in range(rows):
        line = ""
        for c in range(cols):
            v = np.clip((grid[r, c] - lo) / (hi - lo + 1e-9), 0, 1)
            line += RAMP[int(v * (len(RAMP) - 1))]
        out.append(line)
    return grid, out


for p in sys.argv[1:]:
    grid, rows = heat(p)
    print(f"=== {p.split('/')[-1]}   星点密度  min={grid.min():.4f} max={grid.max():.4f} mean={grid.mean():.4f}")
    for line in rows:
        print("  " + line)
    print()
