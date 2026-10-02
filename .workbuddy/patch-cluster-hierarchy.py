# -*- coding: utf-8 -*-
"""星团交互层级重构：区域 / 视觉核心 / 文章星三层 + 明确状态机。

用户定稿规范：
  ① 星团 = 一片空间结构（几乎不可见的区域 + 极淡光晕 + 代表亮星），不是「一堆变亮的星」
  ② 文章星永远是最高优先级目标；点不到星才判星团
  ③ hover 星团：极淡轮廓 + 名字提亮 + 团内星提亮 + 他团降权 —— 不弹信息卡
  ④ 点击星团：锁定 + 细轨道线 + 分类信息成为中心；文章星退一步但不消失
  ⑤ hover 文章星（锁定态）：该星重新亮起 + 信息卡
  ⑥ 三个入口：点星团名 / 点星团外围引力区 / Explore 态靠近吸附
"""
import io, sys

P = 'F:/Projects/know-nothing-about/src/components/BrainGraph.astro'
s = io.open(P, encoding='utf-8').read()
n = 0


def sub(old, new, tag):
    global s, n
    assert s.count(old) == 1, 'anchor miss(%d): %s' % (s.count(old), tag)
    s = s.replace(old, new)
    n += 1
    print('  ok:', tag)


# ---------------------------------------------------------------- ① haloTex
sub(
"    // ===== 远景银河：一个缓缓自转的螺旋星系 =====\n"
"    // 分两级 group：tilt 掌「视角姿态」（倾角 / 对角线），spin 掌「自转」。",
"""    // 星团光晕贴图：极淡的大范围柔光（星团的「空间范围」的可见化）
    // 中心不实心、边缘长尾衰减 —— 读作「一团雾状光晕」而不是「一颗大星」
    const haloTex = glowTexture([
      [0, 'rgba(255,255,255,0.42)'],
      [0.22, 'rgba(255,255,255,0.22)'],
      [0.5, 'rgba(255,255,255,0.07)'],
      [1, 'rgba(255,255,255,0)'],
    ]);

    // ===== 远景银河：一个缓缓自转的螺旋星系 =====
    // 分两级 group：tilt 掌「视角姿态」（倾角 / 对角线），spin 掌「自转」。""",
    'haloTex')

# ---------------------------------------------------------------- ② 星团背景星 → 每团独立对象
old_bg_start = "    // ===== 星团背景星：每团一群域色小星（方案「星团有形体」—— 团块由密集小星组成）====="
i_bg = s.index(old_bg_start)
i_bg_end = s.index("      galaxySpin.add(new THREE.Points(geoB, galaxyMat(0.75, 0.85, 14)));\n    }", i_bg)
i_bg_end += len("      galaxySpin.add(new THREE.Points(geoB, galaxyMat(0.75, 0.85, 14)));\n    }")
new_bg = """    // ===== 星团视觉核心（②层）：每团一群域色小星 + 一片极淡光晕 =====
    // 向心高斯分布（中心密边缘疏）、亮度分级（大部分暗、少数亮）、纯装饰不参与交互。
    // 它们让星团看起来是「一团星星」的实体，而不是空荡的几颗文章星。
    // ★ 每团一个独立 Points：hover / 锁定时要能对「他团降权」，合在一个对象里做不到。
    const clusterBgPts: THREE.Points[] = [];
    const clusterRadOf = (k: number) =>
      Math.max(GR * 0.11, 2.4) * (clusters[k]?.form === 'scatter' ? 1.6 : 1.2);
    {
      const BG = 160;
      for (let k = 0; k < NC; k++) {
        const arr = new Float32Array(BG * 3);
        const col = new Float32Array(BG * 3);
        const sz = new Float32Array(BG);
        const pha = new Float32Array(BG);
        const rngB = mulberry32(hash32('bgstar:' + clusters[k].key));
        // 域色与分类标识色一致（列表页/全站同色系），星海里适度增艳
        const base = vivid(clusters[k]?.color || '#9db8ff');
        const rad = Math.max(GR * 0.085, 2.2);
        // 形态语义（方案「分类星团的视觉结构示意」）：不同分类不同的星团结构
        const form = clusters[k]?.form ?? 'natural';
        for (let i = 0; i < BG; i++) {
          const j = i;
          // 密度与形状随 form：dense 向心团 / spiral 螺线带 / scatter 广布 / natural 均匀
          let th: number, dr: number;
          if (form === 'dense') {
            th = rngB() * Math.PI * 2;
            dr = Math.abs(gj()) * 0.38 * rad;                      // 紧密闭团
          } else if (form === 'spiral') {
            const tt = i * 0.5 + (rngB() - 0.5) * 0.5;             // 规则双螺旋带
            dr = (0.22 + ((tt * 0.42) % 1) * 0.78) * rad;
            th = tt * 1.05 + Math.log(dr + 1) * 1.35;
          } else if (form === 'scatter') {
            th = rngB() * Math.PI * 2;
            dr = (0.1 + 0.9 * Math.sqrt(rngB())) * rad * 1.65;     // 分散广布
          } else {
            th = golden * i + (rngB() - 0.5) * 0.8;                // 随机自然
            dr = (0.25 + 0.75 * Math.sqrt(rngB())) * rad;
          }
          arr[j * 3] = clusPos[k * 3] + Math.cos(th) * dr;
          arr[j * 3 + 1] = clusPos[k * 3 + 1] + Math.sin(th) * dr * 0.75;
          arr[j * 3 + 2] = clusPos[k * 3 + 2] + (rngB() - 0.5) * (form === 'scatter' ? 1.5 : 1.1);
          // 亮度分级（反转：团块整体「亮」，内部有层次）—— 方案图星团是明亮的彩色团
          const roll = rngB();
          let f: number, sMul: number;
          if (roll < 0.40)      { f = 0.55 + rngB() * 0.2; sMul = 0.9; }
          else if (roll < 0.80) { f = 0.78 + rngB() * 0.2; sMul = 1.15; }
          else if (roll < 0.95) { f = 1.0; sMul = 1.4; }
          else                  { f = 1.15; sMul = 1.7; }
          col[j * 3] = base.r * f; col[j * 3 + 1] = base.g * f; col[j * 3 + 2] = base.b * f;
          sz[j] = (0.35 + rngB() * 0.45) * sMul;
          pha[j] = rngB() * Math.PI * 2;
        }
        const geoB = new THREE.BufferGeometry();
        geoB.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        geoB.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        geoB.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
        geoB.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
        geoB.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GR * 1.7);
        const pts = new THREE.Points(geoB, galaxyMat(0.75, 0.85, 14));
        galaxySpin.add(pts);
        clusterBgPts.push(pts);
      }
    }"""
s = s[:i_bg] + new_bg + s[i_bg_end:]
n += 1
print('  ok: clusterBgPts per-cluster')

# ---------------------------------------------------------------- ③ 边界 → 每团独立
i_bd = s.index("    // ===== 星团边界：探索态才浮现的「明确边界线」=====")
i_bd_end = s.index("      galaxySpin.add(clusterBounds);\n    }", i_bd)
i_bd_end += len("      galaxySpin.add(clusterBounds);\n    }")
new_bd = """    // ===== 星团边界（①层的可见化）：探索 / 靠近 / hover / 锁定 才浮现 =====
    // 边界 = 沿星团外缘的一圈虚线星尘（星团是有确定范围的空间结构）；
    // 星云则刻意没有边界（模糊、可穿过星团），二者的对比正是「星团有语义、星云只是环境」。
    // 默认态不显示：默认画面要保持干净，边界是「你正在指代这一片」时才出现的地图信息。
    // ★ 每团独立：hover 只让一个团浮现边界，他团保持安静。
    const clusterBounds: THREE.Points[] = [];
    {
      const SEG = 108;
      for (let k = 0; k < NC; k++) {
        const arr = new Float32Array(SEG * 3);
        const col = new Float32Array(SEG * 3);
        const sz = new Float32Array(SEG);
        const pha = new Float32Array(SEG);
        // 半径贴着星团实际散布范围（scatter 形态铺得更开）
        const rad = clusterRadOf(k);
        const base = vivid(clusters[k]?.color || '#9db8ff');
        for (let i = 0; i < SEG; i++) {
          const th = (i / SEG) * Math.PI * 2;
          const on = i % 2 === 0; // 虚线：隔一留空，明确但不生硬
          arr[i * 3] = clusPos[k * 3] + Math.cos(th) * rad;
          arr[i * 3 + 1] = clusPos[k * 3 + 1] + Math.sin(th) * rad * 0.82;
          arr[i * 3 + 2] = clusPos[k * 3 + 2] + Math.sin(th * 2.0) * 0.55;
          const f = on ? 0.9 : 0.1;
          col[i * 3] = base.r * f; col[i * 3 + 1] = base.g * f; col[i * 3 + 2] = base.b * f;
          sz[i] = on ? 1.0 : 0.4;
          pha[i] = rand() * Math.PI * 2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GR * 1.7);
        const pts = new THREE.Points(geo, galaxyMat(1.15, 0, 13));
        galaxySpin.add(pts);
        clusterBounds.push(pts);
      }
    }

    // ===== 星团区域光晕（①层本体）：几乎不可见的柔光，标定「这一片空间」=====
    // 默认 0.055 —— 凝视才察觉；靠近微起、hover 明确、锁定最强。它从不「变亮成一团星」，
    // 因为星团要表达的语义是「空间范围」，不是「很多颗星」。
    const clusHalo: THREE.Sprite[] = [];
    const clusHaloBase: number[] = [];
    clusters.forEach((c, k) => {
      const mat = new THREE.SpriteMaterial({
        map: haloTex,
        color: vivid(c.color || '#9db8ff'),
        transparent: true,
        opacity: 0.055,
        depthWrite: false,
        blending: THREE.AdditiveBlending, // 光晕只加光：普通混合会把背后的星海压黑
      });
      const sp = new THREE.Sprite(mat);
      const base = clusterRadOf(k) * 2.5;
      sp.scale.setScalar(base);
      sp.position.set(clusPos[k * 3], clusPos[k * 3 + 1], clusPos[k * 3 + 2] - 0.4);
      galaxySpin.add(sp);
      clusHalo.push(sp);
      clusHaloBase.push(base);
    });"""
s = s[:i_bd] + new_bd + s[i_bd_end:]
n += 1
print('  ok: clusterBounds per-cluster + clusHalo')

# ---------------------------------------------------------------- ④ 状态变量
sub(
"    // P0 星团交互层级：hover 唤醒（成员提亮/他团降权）、点击锁定（细轨道线）\n"
"    let hovCluster = -1;               // 当前 hover 的星团（-1 无）",
"""    // P0 星团交互层级：区域 → 视觉核心 → 文章星，三层各有各的表达方式
    let hovCluster = -1;               // 当前 hover 的星团（-1 无）
    // 每团的状态插值（每帧向目标收敛，避免突变）：
    // prox = 鼠标邻近度（0..1，Explore/常态都生效，驱动「吸附」）
    // near = prox 平滑值；hov = hover 平滑值；foc = 锁定平滑值；dim = 他团降权系数
    const clusProx = new Float32Array(NC);
    const clusNearT = new Float32Array(NC);
    const clusHovT = new Float32Array(NC);
    const clusFocT = new Float32Array(NC);
    const clusDimT = new Float32Array(NC).fill(1);
    const clusLabelOp = new Float32Array(NC).fill(1);
    // 文章星所属星团（状态机按团算倍率，避免多处写 starSize 互相覆盖）
    const starClusterIdx = new Int16Array(NS);""",
    'state vars')

# 恒星生成时记录所属团
sub(
"        starPos[i * 3] = clusPos[k * 3] + Math.cos(th) * rr;",
"        starClusterIdx[i] = k;\n        starPos[i * 3] = clusPos[k * 3] + Math.cos(th) * rr;",
    'starClusterIdx')

# ---------------------------------------------------------------- ⑤ 拾取：引力区半径动态化
sub(
"""      if (best < 0) {
        for (let k = 0; k < NC; k++) {
          const p = screenOf(clusPos, k);
          if (p.z > 1) continue;
          const d = Math.hypot(p.x - cx, p.y - cy);
          if (d < HIT_CLUSTER && d < bestD) { bestD = d; best = k; kind = 'cluster'; }
        }
      }""",
"""      // ★ 星团永远只在「没点到任何文章星」时才判定 —— 文章星是最高优先级目标。
      //   不会出现「我点的是文章，却打开了分类」。
      if (best < 0) {
        for (let k = 0; k < NC; k++) {
          const p = screenOf(clusPos, k);
          if (p.z > 1) continue;
          const d = Math.hypot(p.x - cx, p.y - cy);
          // 外围引力区：半径由星团的实际投影大小决定（不是写死的像素），
          // 再外扩一点 —— 星团是「一片空间」，点它周围的空白也算指向这一片。
          const r = Math.max(40, clusterScreenR(k) * 1.2 + 22);
          if (d < r && d < bestD) { bestD = d; best = k; kind = 'cluster'; }
        }
      }""",
    'pick gravity field')

# clusterScreenR 工具函数（放在 screenOf 之后）
sub(
"""    function pick(cx: number, cy: number) {""",
"""    // 星团在屏幕上的视觉半径（盘内正交两方向投影后取平均）：引力区随缩放/视角自动伸缩
    function clusterScreenR(k: number) {
      const cx = clusPos[k * 3], cy = clusPos[k * 3 + 1], cz = clusPos[k * 3 + 2];
      const r = clusterRadOf(k);
      const a = screenOfRaw(cx, cy, cz);
      const bx = screenOfRaw(cx + r, cy, cz);
      const by = screenOfRaw(cx, cy + r, cz);
      return (Math.hypot(bx.x - a.x, bx.y - a.y) + Math.hypot(by.x - a.x, by.y - a.y)) * 0.5;
    }

    function pick(cx: number, cy: number) {""",
    'clusterScreenR')

# ---------------------------------------------------------------- ⑥ pointermove：吸附 + 星团不弹卡
sub(
"""      } else if (e.pointerType === 'mouse') {
        const h = pick(e.clientX, e.clientY);
        hitKind = h.kind; hitIdx = h.idx;
        rawMx = e.clientX; rawMy = e.clientY;
        mount.classList.toggle('pointing', hitIdx >= 0);
        hovCluster = hitKind === 'cluster' ? hitIdx : -1; // 星团唤醒状态
        // 预唤醒：没命中星/星团、但鼠标在某星团 150px 内 → 该星团光环极淡浮现（「轻微响应」）
        if (hitIdx < 0 && !focusRing.visible) {
          let pre = -1, preD = 150;
          for (let k = 0; k < NC; k++) {
            const p = screenOf(clusPos, k);
            if (p.z > 1) continue;
            const d = Math.hypot(p.x - e.clientX, p.y - e.clientY);
            if (d < preD) { preD = d; pre = k; }
          }
          if (pre >= 0) {
            const p = screenOf(clusPos, pre);
            ring.visible = true;
            ring.position.set(clusPos[pre * 3], clusPos[pre * 3 + 1], clusPos[pre * 3 + 2]);
            ring.scale.setScalar(3.4);
            (ring.material as THREE.SpriteMaterial).opacity = 0.22; // 预唤醒：极淡
          } else {
            ring.visible = false;
          }
        } else if (hitIdx < 0) {
          ring.visible = false;
        }
        if (hitIdx >= 0) showTip(hitKind, hitIdx); else tip.classList.remove('show');
      }""",
"""      } else if (e.pointerType === 'mouse') {
        const h = pick(e.clientX, e.clientY);
        hitKind = h.kind; hitIdx = h.idx;
        rawMx = e.clientX; rawMy = e.clientY;
        mount.classList.toggle('pointing', hitIdx >= 0);
        hovCluster = hitKind === 'cluster' ? hitIdx : -1; // 星团 hover 状态
        // 吸附（⑥入口 3）：鼠标越靠近某星团，该团邻近度越高 —— 光晕微起、标签被轻轻牵引。
        // 不是「立刻选中」，而是先有视觉回应；再靠近才由 pick 判为 hover。
        for (let k = 0; k < NC; k++) {
          const p = screenOf(clusPos, k);
          const d = p.z > 1 ? 1e9 : Math.hypot(p.x - e.clientX, p.y - e.clientY);
          const reach = Math.max(120, clusterScreenR(k) * 2.0);
          clusProx[k] = Math.max(0, 1 - d / reach);
        }
        // 悬停圆环只给文章星：星团用「光晕 + 边界」表达，不再套一个大圆环
        ring.visible = hitIdx >= 0 && hitKind === 'star';
        // ★ hover 星团不弹信息卡：星团是一片空间，不是对象。
        //   只做「边界浮现 + 名字提亮 + 团内星提亮 + 他团降权」；
        //   分类信息要到点击锁定后才出现（移动端点选仍走底部卡片）。
        if (hitIdx >= 0 && hitKind !== 'cluster') showTip(hitKind, hitIdx);
        else tip.classList.remove('show');
      }""",
    'pointermove adsorption + no card on cluster hover')

# ---------------------------------------------------------------- ⑦ flyTo / flyBack 交出 starSize 控制权
sub(
"""      // 聚焦态成员星降权 ×0.85（方案「文章星退一步」：名称与信息成为视觉中心，hover 时再亮起）
      for (const i of clusterStars[k]) {
        starSize[i] = starSizeBase[i] * 0.85;
      }
      starGeo.attributes.aSize.needsUpdate = true;
""",
"""      // 文章星「退一步」由主循环状态机统一处理（聚焦团 0.82 / 他团 0.55），此处不再直接写 starSize
""",
    'flyTo hand off starSize')
sub(
"""      // 恢复聚焦星团成员星尺寸
      if (lastFocusIdx >= 0) {
        for (const i of clusterStars[lastFocusIdx]) {
          starSize[i] = starSizeBase[i];
        }
        starGeo.attributes.aSize.needsUpdate = true;
      }
""",
"""      // 恢复同样交给状态机（他团降权系数回到 1）
""",
    'flyBack hand off starSize')

# ---------------------------------------------------------------- ⑧ 主循环：统一状态机
sub(
"""      // 星团边界：Explore 态才浮现（默认态 0），与「星云无边界」形成语义对比
      clusterBounds.material.uniforms.uOpacity.value = exploreT * (0.5 + Math.sin(t * 0.33) * 0.07);
""",
"", 'remove old bounds line')

sub(
"""      // P0 星团唤醒：hover 星团时成员星缓慢提亮 1.3 倍、他团标签降权；轨道线慢转
      {
        const hov = hovCluster;
        for (let k = 0; k < NC; k++) {
          const members = clusterStars[k];
          const lift = hov === k ? 1.35 : 1;
          for (const i of members) {
            const v = starSizeBase[i] * lift;
            if (Math.abs(starSize[i] - v) > 0.02) { starSize[i] = v; starGeo.attributes.aSize.needsUpdate = true; }
          }
        }
      }
""",
"""      // ===== 星团交互层级状态机（方案定稿）=====
      // ① 区域（光晕+边界） ② 视觉核心（背景星+光晕） ③ 文章星（可点，永远最高优先级）
      // 状态：idle 淡淡聚集 / near 微光晕 / hover 边界浮现 / focus 锁定+轨道线 / dim 他团降权
      {
        const breath = 0.5 + 0.5 * Math.sin(t * 0.33);
        const hoverStarIdx = hitKind === 'star' ? hitIdx : -1;
        for (let k = 0; k < NC; k++) {
          const isFoc = focusIdx === k;
          const isHov = hovCluster === k;
          // 邻近度：只有鼠标在画布上时才有效（触屏无 hover，保持 0）
          clusNearT[k] += (clusProx[k] - clusNearT[k]) * Math.min(1, dt * 4);
          clusHovT[k] += ((isHov ? 1 : 0) - clusHovT[k]) * Math.min(1, dt * 5);
          clusFocT[k] += ((isFoc ? 1 : 0) - clusFocT[k]) * Math.min(1, dt * 3);
          // 他团降权：有 hover / 锁定目标时，其余星团整体退进背景
          const dimTgt = focusIdx >= 0 ? (isFoc ? 1 : 0.32)
            : hovCluster >= 0 ? (isHov ? 1 : 0.5) : 1;
          clusDimT[k] += (dimTgt - clusDimT[k]) * Math.min(1, dt * 4);
          const d = clusDimT[k];
          // ① 区域光晕：默认几乎不可见，靠近微起，hover 明确，锁定最强（都乘他团降权）
          const haloOp = (0.055 + clusNearT[k] * 0.05 + clusHovT[k] * 0.085 + clusFocT[k] * 0.10) * d;
          (clusHalo[k].material as THREE.SpriteMaterial).opacity = haloOp * (0.9 + breath * 0.12);
          clusHalo[k].scale.setScalar(clusHaloBase[k] * (1 + clusNearT[k] * 0.05 + clusFocT[k] * 0.08));
          // ② 边界：默认无；靠近极淡；hover 明确；锁定最实；探索态整体浮现
          clusterBounds[k].material.uniforms.uOpacity.value = Math.max(
            exploreT * 0.5,
            clusNearT[k] * 0.13,
            clusHovT[k] * 0.34,
            clusFocT[k] * 0.6,
          ) * d * (0.92 + breath * 0.08);
          // ③ 视觉核心（背景星）：他团降权，hover/锁定时本团略提
          clusterBgPts[k].material.uniforms.uOpacity.value =
            0.85 * d * (1 + clusHovT[k] * 0.22 + clusFocT[k] * 0.12);
          // 标签存在感：他团压暗，本团随状态提亮（聚焦时最亮，名称与信息成为视觉中心）
          clusLabelOp[k] = d * (0.72 + clusHovT[k] * 0.18 + clusFocT[k] * 0.28);
        }
        // 文章星层级（唯一写入点 —— 以前多处写 starSize 会互相覆盖）
        // 默认 1.0 / hover 星团 团内 1.18 团外 0.86 / 锁定 团内 0.82（退一步）他团 0.55
        // hover 某颗星 → 该星重新亮起（×hoverScale），成为主角 —— 两个层级互不吞掉
        for (let i = 0; i < NS; i++) {
          const k = starClusterIdx[i];
          let m = 1;
          if (focusIdx >= 0) m = k === focusIdx ? 0.82 : 0.55;
          else if (hovCluster >= 0) m = k === hovCluster ? 1.18 : 0.86;
          if (i === hoverStarIdx) m *= hoverScale;
          const v = starSizeBase[i] * m;
          if (Math.abs(starSize[i] - v) > 0.01) { starSize[i] = v; starGeo.attributes.aSize.needsUpdate = true; }
        }
      }
""",
    'cluster state machine')

# hover 恒星块：只保留 hoverScale 平滑，不再写 starSize
sub(
"""      // P0 hover 恒星放大：星星先大起来，信息卡再出现（方案文档交互顺序）
      {
        if (hoverPrev !== (hitKind === 'star' ? hitIdx : -1)) {
          if (hoverPrev >= 0) { starSize[hoverPrev] = starSizeBase[hoverPrev]; }
          hoverPrev = hitKind === 'star' ? hitIdx : -1;
          starGeo.attributes.aSize.needsUpdate = true;
        }
        const target = hitIdx >= 0 && hitKind === 'star' ? 1.65 : 1;
        hoverScale += (target - hoverScale) * 0.18;
        if (hitIdx >= 0) {
          const v = starSizeBase[hitIdx] * hoverScale;
          if (Math.abs(starSize[hitIdx] - v) > 0.01) {
            starSize[hitIdx] = v;
            starGeo.attributes.aSize.needsUpdate = true;
          }
        }
      }""",
"""      // P0 hover 恒星放大：星星先大起来，信息卡再出现（方案文档交互顺序）
      // 尺寸写入统一在星团状态机里（hover 星团 / 锁定星团 的倍率也作用在同一颗星上）
      {
        hoverPrev = hitKind === 'star' ? hitIdx : -1;
        const target = hitIdx >= 0 && hitKind === 'star' ? 1.65 : 1;
        hoverScale += (target - hoverScale) * 0.18;
      }""",
    'hover star only drives hoverScale')

# ring 跟随：星团不再套大圆环
sub(
"""        ring.position.set(arr[hitIdx * 3], arr[hitIdx * 3 + 1], arr[hitIdx * 3 + 2]);
        ring.scale.setScalar(hitKind === 'cluster' ? 3.4 : 1.15); // 星团环罩住整团""",
"""        ring.position.set(arr[hitIdx * 3], arr[hitIdx * 3 + 1], arr[hitIdx * 3 + 2]);
        ring.scale.setScalar(1.15); // 只罩文章星：星团用光晕+边界表达，不套圆环""",
    'ring star only')

# ---------------------------------------------------------------- ⑨ 标签：状态类 + 降权
sub(
"""          // 吸附感：hover 的星团标签向鼠标方向轻微偏移（靠近的「牵引」暗示）
          let px = p.x, py = p.y;
          if (hovCluster === p.L.k) {
            const mdx = rawMx - px, mdy = rawMy - (p.y + 18);
            const md = Math.hypot(mdx, mdy) || 1;
            const pull = Math.min(5, 50 / md);
            px += (mdx / md) * pull; py += (mdy / md) * pull;
          }
          p.L.el.style.transform = `translate(${px}px, ${py}px) translate(-50%, 20px)`;
          // 写死数值而非空串：CSS 默认 opacity:0，空串会回落到隐形
          p.L.el.style.opacity = busy ? '0' : '1';""",
"""          // 吸附感（入口 3）：靠近的星团标签被鼠标轻轻牵引（不是立刻选中，只是「有回应」）。
          // 牵引强度随邻近度渐强 —— 鼠标越近，整片区域越像被磁场拉动。
          let px = p.x, py = p.y;
          const pk = clusNearT[p.L.k];
          if (pk > 0.01) {
            const mdx = rawMx - px, mdy = rawMy - (p.y + 18);
            const md = Math.hypot(mdx, mdy) || 1;
            const pull = Math.min(6, 50 / md) * (0.35 + pk * 0.65);
            px += (mdx / md) * pull; py += (mdy / md) * pull;
          }
          p.L.el.style.transform = `translate(${px}px, ${py}px) translate(-50%, 20px)`;
          // 写死数值而非空串：CSS 默认 opacity:0，空串会回落到隐形。
          // 他团降权 + hover/锁定提亮：名称与信息成为视觉中心时，它自然最亮。
          const op = busy ? 0 : Math.min(1, clusLabelOp[p.L.k]);
          p.L.el.style.opacity = String(op);
          p.L.el.dataset.state = focusIdx === p.L.k ? 'focus'
            : hovCluster === p.L.k ? 'hover' : clusDimT[p.L.k] < 0.8 ? 'dim' : 'idle';""",
    'label state + dim')

sub(
"""        items.filter((p) => !p.ok).forEach((p) => {
          p.L.el.style.opacity = '0';
          p.L.el.style.pointerEvents = 'none';
        });""",
"""        items.filter((p) => !p.ok).forEach((p) => {
          p.L.el.style.opacity = '0';
          p.L.el.style.pointerEvents = 'none';
          p.L.el.dataset.state = 'idle';
        });""",
    'label reset state')

# ---------------------------------------------------------------- ⑩ CSS：状态样式
sub(
"""  .graph-frame :global(.cluster-label:hover) {
    color: #ffc46b;
  }

  .graph-frame :global(.cl-count) {
    opacity: 0.5;
    letter-spacing: 0.1em;
  }""",
"""  /* hover 星团：名字亮一点、篇数浮出来（不弹卡片，只是「这一片被点亮了」） */
  .graph-frame :global(.cluster-label[data-state="hover"]) {
    color: #ffd9a0;
    text-shadow: 0 1px 10px rgba(7, 8, 14, 0.95), 0 0 18px rgba(255, 196, 107, 0.35);
  }
  /* 点击锁定：名称与信息成为视觉中心 */
  .graph-frame :global(.cluster-label[data-state="focus"]) {
    color: #ffc46b;
    font-size: 12px;
    text-shadow: 0 1px 10px rgba(7, 8, 14, 0.95), 0 0 22px rgba(255, 196, 107, 0.45);
  }
  .graph-frame :global(.cluster-label[data-state="dim"]) {
    color: rgba(232, 230, 223, 0.72);
  }

  .graph-frame :global(.cl-count) {
    opacity: 0.5;
    letter-spacing: 0.1em;
    transition: opacity 0.3s ease, color 0.3s ease;
  }

  .graph-frame :global(.cluster-label[data-state="hover"]) .cl-count,
  .graph-frame :global(.cluster-label[data-state="focus"]) .cl-count {
    opacity: 1;
    color: #ffc46b;
  }""",
    'label state CSS')

io.open(P, 'w', encoding='utf-8', newline='').write(s)
print('patched', n, 'anchors')
