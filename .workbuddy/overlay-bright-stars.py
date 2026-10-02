"""在擦除后的星野底片上叠加 8 颗很亮的星（径向渐变实心圆 + 锐白核）。"""
from PIL import Image, ImageDraw
from pathlib import Path

SRC = Path(r"F:/Projects/know-nothing-about/processed_image_img90492611-03dafc81-6ae9-4d96-a62d-4245fc014a34_1.png")
OUT = Path(r"F:/Projects/know-nothing-about/.shots/firstframe-clean.png")
OUT.parent.mkdir(parents=True, exist_ok=True)

img = Image.open(SRC).convert("RGBA")
W, H = img.size
print(f"size: {W}x{H}")

# (x_norm, y_norm, 总半径, 色温 RGB)
star_specs = [
    (0.08, 0.18,  90, (200, 215, 255)),
    (0.92, 0.30,  80, (255, 240, 220)),
    (0.18, 0.78,  70, (210, 222, 255)),
    (0.83, 0.86, 100, (255, 220, 180)),
    (0.50, 0.10,  60, (240, 245, 255)),
    (0.55, 0.96,  75, (255, 235, 200)),
    (0.72, 0.55,  85, (220, 230, 255)),
    (0.32, 0.50,  80, (255, 230, 190)),
]

overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))

for xn, yn, R, (r, g, b) in star_specs:
    cx, cy = int(W * xn), int(H * yn)
    sz = R * 2 + 20
    layer = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    c = sz // 2

    # 径向渐变：从内到外，alpha 从 0 → max → 0
    # 内圈是柔和过渡区（暖白色），最内几个像素直接纯白实心
    steps = 60
    for i in range(steps, 0, -1):
        u = i / steps  # 1 = 最外，0 = 最内
        rr = max(1, int(R * u))
        # 形状：高斯型衰减，峰值在中间偏内
        # alpha(u) = 255 * exp(-((u - 0.0) / 0.4)^2) — 中心最亮
        import math
        a = int(255 * math.exp(-((u - 0.0) / 0.42) ** 2))
        if a < 1: continue
        # 颜色：从中心的暖白逐渐过渡到外圈的色温
        # i/steps 小（中心）→ 接近纯白；大（外缘）→ 色温颜色
        mix = max(0, min(1, (u - 0.0) / 0.4))
        cr = int(255 * (1 - mix) + r * mix)
        cg = int(255 * (1 - mix) + g * mix)
        cb = int(255 * (1 - mix) + b * mix)
        ld.ellipse([c - rr, c - rr, c + rr, c + rr], fill=(cr, cg, cb, a))

    overlay.alpha_composite(layer, dest=(cx - c, cy - c))

out = Image.alpha_composite(img, overlay).convert("RGB")
out.save(OUT, optimize=True)
print(f"saved: {OUT}  ({OUT.stat().st_size//1024} KB)")