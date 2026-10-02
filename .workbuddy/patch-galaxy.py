# -*- coding: utf-8 -*-
"""把 BrainGraph 里的「椭圆环银河」替换为「螺旋星系」，并按新结构重建层定义。"""
import io, re

P = 'F:/Projects/know-nothing-about/src/components/BrainGraph.astro'
src = io.open(P, encoding='utf-8').read()
L = src.split('\n')  # 0-indexed: line N -> L[N-1]

def seg(a, b):
    return '\n'.join(L[a - 1:b])

# ---------- A: galaxy 姿态 group（586-595） ----------
NEW_A = '''    // ===== 远景银河：一个缓缓自转的螺旋星系 =====
    // 分两级 group：tilt 掌「视角姿态」（倾角 / 对角线），spin 掌「自转」。
    // 必须分开 —— 自转要绕盘自身的法线（局部 z）转；若直接转外层 z，会变成「甩Albania盘子」而不是自转。
    const dustMats = [];
    const galaxyTilt = new THREE.Group();
    const galaxySpin = new THREE.Group();
    galaxyTilt.add(galaxySpin);
    // x: 盘面后仰 → 椭圆透视；z: 长轴摆到左下→右上对角
    galaxyTilt.rotation.set(0.873, 0, 0.58);
    // 星系中心压到画面中线以下：上半(Image half)留给标语/标题，黑得多才「深邃」
    galaxyTilt.position.set(0, -1.2, -30);
    scene.add(galaxyTilt);'''

# ---------- B: 删除 makeDust（597-681） ----------
NEW_B = None  # 整段删除

# ---------- C: makeRing + 旧参数 + 层调用（683-806）→ 螺旋星系 ----------
NEW_C = '''    // ===== 螺旋星系布点 =====
    // 形态 = ① 指数盘：密度向中心集中  ② 对数螺旋 θ = 分支基角 + sweep·(r/R)
    //        ③ 厚度 ∝ exp(-r/rs)：中心鼓、外盘薄 —— 斜视时中央是「一团」、外围是「一张极薄的片」，
    //           这个厚薄反差就是纵深感最强的线索  ④ 独立核球星团（暖色）
    const GR = 25 * gScale;   // 盘半径（世界单位）
    const SWEEP = 3.4;        // 旋臂缠绕量（rad）：3.4 ≈ 195°，优雅且不闭合
    const ARMS = 2;
    const gj = () => (rand() + rand() + rand() - 1.5) * 2; // 近似标准正态

    function galaxyMat(size, opacity, maxPx) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 }, uTex: { value: dotTex },
          uSize: { value: size }, uOpacity: { value: opacity },
          uScale: { value: 450 }, uMax: { value: maxPx },
        },
        vertexShader: `
          attribute vec3 aColor;
          attribute float aSize;
          attribute float aPhase;
          uniform float uTime;
          uniform float uScale;
          uniform float uSize;
          uniform float uMax;
          varying vec3 vColor;
          varying float vTw;
          varying float vFade;
          void main() {
            vColor = aColor;
            vTw = 0.58 + 0.42 * sin(uTime * (0.5 + fract(aPhase * 7.31) * 1.7) + aPhase * 41.0);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            // 远暗近亮 ≈ 2.3:1：立体感主要靠【大小梯度】，亮度对比过强会把远半(yanic科的旋臂)压没
            vFade = clamp(1.9 - (-mv.z) * 0.022, 0.5, 1.3);
            float s = uSize * aSize * (uScale / -mv.z) * (0.84 + 0.16 * vTw);
            gl_PointSize = uMax * s / (uMax + s); // 软钳：保留近远梯度，又不炸成光斑
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform sampler2D uTex;
          uniform float uOpacity;
          varying vec3 vColor;
          varying float vTw;
          varying float vFade;
          void main() {
            vec4 tex = texture2D(uTex, gl_PointCoord);
            // 空气透视：越远越沉入夜空冷色 —— 深邃感的第二条线索
            vec3 col = mix(vColor, vec3(0.60, 0.70, 0.94), clamp((1.0 - vFade) * 0.45, 0.0, 0.22));
            gl_FragColor = vec4(col * tex.rgb, tex.a * uOpacity * vTw * vFade);
          }`,
        transparent: true, depthWrite: false,
      });
      dustMats.push(mat);
      mat.userData.baseMax = maxPx;
      return mat;
    }

    // 盘星（含旋臂调制）：spread 越小 → 越贴臂线，旋臂越清晰
    function makeDisk(count, spread, size, opacity, maxPx, warmMix, bright) {
      const arr = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const sz = new Float32Array(count);
      const pha = new Float32Array(count);
      const cCool = new THREE.Color(0xd4dced);
      const cWarm = new THREE.Color(0xffd9a0);
      for (let i = 0; i < count; i++) {
        const u = rand();
        const r0 = Math.pow(u, 0.72) * GR;
        const branch = Math.floor(rand() * ARMS);
        const th = branch * ((Math.PI * 2) / ARMS) + SWEEP * (r0 / GR) + gj() * (spread * (0.35 + 0.9 * r0 / GR));
        const rr = Math.max(0.2, r0 + gj() * (spread * GR * (0.25 + 0.75 * r0 / GR)));
        arr[i * 3] = Math.cos(th) * rr;
        arr[i * 3 + 1] = Math.sin(th) * rr;
        // 厚度：中心鼓包 + 外盘薄 —— 斜视下的「纵深感」几乎全来自这一行
        const bulge = Math.exp(-Math.pow(Math.min(rr / (GR * 0.24), 20), 1.4));
        arr[i * 3 + 2] = gj() * 1.4 * (0.20 + 3.0 * bulge);
        // 内暖外冷（真实的星族渐变）：中心呼应站点的琥珀，外围是冷蓝夜
        const warm = Math.min(1, Math.max(0, 1 - (rr / GR) * 1.6)) * (rand() * 0.6 + 0.4) * warmMix;
        const c = cCool.clone().lerp(cWarm, warm);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        // 粒度幂律：海量 1px 级微星融成连续星海，极少数大星 —— 深邃 = 大小跨度，不是星星多
        sz[i] = (0.35 + 0.65 * Math.pow(rand(), 3)) * bright;
        pha[i] = rand() * Math.PI * 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GR * 1.7);
      const pts = new THREE.Points(geo, galaxyMat(size, opacity, maxPx));
      galaxySpin.add(pts);
      return pts;
    }

    // 核球：扁椭球星团，暖色、密集 —— 星系的视觉锚点
    function makeBulge(count) {
      const arr = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      const sz = new Float32Array(count);
      const pha = new Float32Array(count);
      const cWarm = new THREE.Color(0xffe0b0);
      const cCore = new THREE.Color(0xfff0d4);
      for (let i = 0; i < count; i++) {
        const rb = Math.abs(gj()) * GR * 0.10;
        const tb = rand() * Math.PI * 2;
        arr[i * 3] = Math.cos(tb) * rb;
        arr[i * 3 + 1] = Math.sin(tb) * rb * 0.85;
        arr[i * 3 + 2] = gj() * GR * 0.045;
        const c = cWarm.clone().lerp(cCore, 1 - Math.min(1, rb / (GR * 0.1)));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        sz[i] = (0.35 + 0.65 * Math.pow(rand(), 3)) * 0.7;
        pha[i] = rand() * Math.PI * 2;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GR * 0.4);
      const pts = new THREE.Points(geo, galaxyMat(0.15, 0.72, 8));
      galaxySpin.add(pts);
      return pts;
    }

    // 四层：微星海（连续辉光）· 旋臂亮脊（勾出螺旋）· 核球（暖锚点）· 弥漫雾（极淡）
    const galDisk  = makeDisk(Math.round(12000 * DN), 0.045, 0.16, 0.80, 9, 0.8, 1);
    const galArms  = makeDisk(Math.round(1800 * DN), 0.022, 0.34, 0.72, 11, 0.35, 1.5);
    const galBulge = makeBulge(Math.round(2000 * DN));
    const galHalo  = makeDisk(Math.round(500 * DN), 0.16, 1.10, 0.035, 20, 0.5, 1);'''

assert 'function makeDust' in seg(597, 597), seg(597, 597)
assert 'function makeRing' in seg(685, 685), seg(684, 684)
assert 'const dustHalo' in seg(806, 806), seg(806, 806)
assert 'const galaxyGroup' in seg(588, 588), seg(588, 588)

out = []
out += L[:585]                 # 1..585 保留
out += NEW_A.split('\n')       # 586..: 新 group
# 跳过 586-595 旧 galaxy group，进入 596 空行 -> 由 NEW_A 之后接跳过
out += L[595:596]              # 596 空行
# 跳过 597-681 (makeDust)
out += L[681:682]              # 682 空行
out += NEW_C.split('\n')       # 683.. : 星系
out += L[806:]                 # 807 起保留（空行 + 背景星幕 ...）
new = '\n'.join(out)
io.open(P, 'w', encoding='utf-8', newline='').write(new)
print('lines:', len(L), '->', len(new.split('\n')))
for kw in ['makeDust', 'makeRing', 'galaxyGroup']:
    print(kw, 'remaining:', len(re.findall(kw, new)))
