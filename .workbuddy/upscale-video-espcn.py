"""用 ESPCN 神经网络把 1080P 星野视频升采样到 2 倍（约 3.5K）。"""
import cv2
from pathlib import Path
import sys

IN = Path(r"F:/Projects/know-nothing-about/.shots/Cinematic_5_second_shot__a_pur_2026-09-27T07-15-34.mp4")
MODEL = Path(r"F:/Projects/know-nothing-about/.workbuddy/models/ESPCN_x2.pb")
OUT = Path(r"F:/Projects/know-nothing-about/.shots/starfield-2x.mp4")

print(f"input:  {IN}")
print(f"model:  {MODEL}")
print(f"output: {OUT}")

if not IN.exists():
    sys.exit(f"input missing: {IN}")
if not MODEL.exists():
    sys.exit(f"model missing: {MODEL}")
OUT.parent.mkdir(parents=True, exist_ok=True)

# 加载 ESPCN 模型
sr = cv2.dnn_superres.DnnSuperResImpl_create()
sr.readModel(str(MODEL))
sr.setModel("espcn", 2)
print("model loaded: ESPCN x2")

# 输入视频
cap = cv2.VideoCapture(str(IN))
fps = cap.get(cv2.CAP_PROP_FPS)
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
w0 = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
h0 = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
print(f"src: {w0}x{h0} @ {fps:.2f}fps  {total}frames")

# 输出视频（先读一帧拿到目标尺寸）
ok, first = cap.read()
if not ok: sys.exit("failed to read first frame")
up = sr.upsample(first)
h1, w1 = up.shape[:2]
print(f"dst: {w1}x{h1}")

fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(str(OUT), fourcc, fps, (w1, h1))

# 把第一帧写回
writer.write(up)

# 逐帧处理
import time
t0 = time.time()
done = 1
while True:
    ok, frame = cap.read()
    if not ok: break
    out = sr.upsample(frame)
    writer.write(out)
    done += 1
    if done % 10 == 0 or done == total:
        elapsed = time.time() - t0
        eta = elapsed / (done - 1) * (total - done + 1) if done > 1 else 0
        pct = done / total * 100
        print(f"  {done}/{total} ({pct:.0f}%)  elapsed {elapsed:.1f}s  eta {eta:.1f}s")

cap.release()
writer.release()
total_t = time.time() - t0
print(f"done in {total_t:.1f}s, saved: {OUT}  ({OUT.stat().st_size//1024//1024} MB)")