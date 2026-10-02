# -*- coding: utf-8 -*-
"""首页银河：① 一屏布局修复 ② 星团色彩辨识度 ③ 银河色阶对齐方案图
   ④ 星云重写（密度结构 + 亮度分级 + 加性混合）⑤ 探索态星团边界线"""
import io, re, sys

ROOT = 'F:/Projects/know-nothing-about/'
BG = ROOT + 'src/components/BrainGraph.astro'
IDX = ROOT + 'src/pages/index.astro'

s = io.open(BG, encoding='utf-8').read()
idx = io.open(IDX, encoding='utf-8').read()
before = s, idx


def sub(text, old, new, tag, count=1):
    n = text.count(old)
    if n != count:
        print('FAIL %s: expected %d occurrence(s), found %d' % (tag, count, n))
        sys.exit(1)
    return text.replace(old, new)


# ---------- ① 一屏布局：footer 高度没算进，导致首页可滚 113px ----------
idx = sub(idx,
"""  .night {
    padding: 64px 0 40px;
    min-height: calc(100svh - 73px); /* 扣掉页头高度：银河+沉底标语正好占满首屏，不溢出 */""",
"""  .night {
    /* 高度交给 flex（body.is-home 是 flex 列，main flex:1）：不再写死 100svh-N。
       写死就会漏算 footer（89px）+ main 底距，首页重新变成可滚动，
       fixed 星空又会随滚动微扭。 */
    padding: 64px 0 40px;
    flex: 1 1 auto;
    min-height: 0;""", 'layout-night')

idx = sub(idx,
"""  :global(body.is-home main.site-main) {
    padding-bottom: 24px;
  }""",
"""  :global(body.is-home main.site-main) {
    padding-bottom: 0; /* 一屏布局：底部留白会让文档高过视口 */
  }""", 'layout-main-padding')

# ---------- ② 星团色彩：域色提饱和（方案图四团一眼可辨）----------
# 域色增艳：站点色板偏灰（#93a9d6 之类），直接用在星海里辨识度不足。
# 只提饱和不动色相 —— 与列表页/全站标识色同源，视觉上仍是同一个色系。
s = sub(s,
"""    // ===== 内容层：星团（分类）与恒星（文章 / 项目）=====""",
"""    // 域色增艳：CATEGORIES 色板偏灰（#93a9d6 一类），在星海里辨识度不足。
    // 只提饱和 + 略提亮度，不动色相 —— 与列表页标识色同源，仍是同一色系。
    const vivid = (hex: string) => {
      const c = new THREE.Color(hex);
      const hsl = { h: 0, s: 0, l: 0 };
      c.getHSL(hsl);
      return c.setHSL(hsl.h, Math.min(1, hsl.s * 1.75), Math.min(0.74, hsl.l * 1.18));
    };

    // ===== 内容层：星团（分类）与恒星（文章 / 项目）=====""", 'vivid-helper')

s = sub(s,
"""        // 恒星色：统一染所属星团域色（同星团同色系；新星/亮星靠尺寸+光环区分，不改色相）
        const base = new THREE.Color(clusters[k]?.color || '#f3efe2');
        const c = new THREE.Color(0xffffff).lerp(base, 0.55);""",
"""        // 恒星色：统一染所属星团域色（同星团同色系；新星/亮星靠尺寸+光环区分，不改色相）
        // 0.78（原 0.55）：掺白越少，团与团越能一眼分开（方案图「少量颜色区分」）
        const base = vivid(clusters[k]?.color || '#f3efe2');
        const c = new THREE.Color(0xffffff).lerp(base, 0.78);""", 'star-color')

s = sub(s,
"""        // 域色与分类标识色一致（列表页/全站同色系）
        const base = new THREE.Color(clusters[k]?.color || '#9db8ff');""",
"""        // 域色与分类标识色一致（列表页/全站同色系），星海里适度增艳
        const base = vivid(clusters[k]?.color || '#9db8ff');""", 'bgstar-color')

# ---------- ③ 星团边界：探索态才浮现的明确边界线 ----------
s = sub(s,
"""    // ===== 星云（纯装饰，与星团/分类无关，不存储任何信息）=====""",
"""    // ===== 星团边界：探索态才浮现的「明确边界线」=====
    // 边界 = 沿星团外缘的一圈虚线星尘（星团是有确定范围的空间结构）；
    // 星云则刻意没有边界（模糊、可穿过星团），二者的对比正是「星团有语义、星云只是环境」。
    // 默认态不显示：默认画面要保持干净，边界是探索时才揭开的地图信息。
    let clusterBounds: THREE.Points;
    {
      const SEG = 108;
      const arr = new Float32Array(NC * SEG * 3);
      const col = new Float32Array(NC * SEG * 3);
      const sz = new Float32Array(NC * SEG);
      const pha = new Float32Array(NC * SEG);
      for (let k = 0; k < NC; k++) {
        // 半径贴着星团实际散布范围（scatter 形态铺得更开）
        const rad = Math.max(GR * 0.11, 2.4) * (clusters[k]?.form === 'scatter' ? 1.6 : 1.2);
        const base = vivid(clusters[k]?.color || '#9db8ff');
        for (let i = 0; i < SEG; i++) {
          const j = k * SEG + i;
          const th = (i / SEG) * Math.PI * 2;
          const on = i % 2 === 0; // 虚线：隔一留空，明确但不生硬
          arr[j * 3] = clusPos[k * 3] + Math.cos(th) * rad;
          arr[j * 3 + 1] = clusPos[k * 3 + 1] + Math.sin(th) * rad * 0.82;
          arr[j * 3 + 2] = clusPos[k * 3 + 2] + Math.sin(th * 2.0) * 0.55;
          const f = on ? 0.9 : 0.1;
          col[j * 3] = base.r * f; col[j * 3 + 1] = base.g * f; col[j * 3 + 2] = base.b * f;
          sz[j] = on ? 1.0 : 0.4;
          pha[j] = rand() * Math.PI * 2;
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
      geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      geo.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GR * 1.7);
      clusterBounds = new THREE.Points(geo, galaxyMat(1.15, 0, 13));
      galaxySpin.add(clusterBounds);
    }

    // ===== 星云（纯装饰，与星团/分类无关，不存储任何信息）=====""", 'cluster-bounds')

# ---------- ④ 银河色阶：外盘更蓝（方案图冷暖对比）----------
s = sub(s,
"""      const cCool = new THREE.Color(0xd4dced);
      const cWarm = new THREE.Color(0xffd9a0);""",
"""      const cCool = new THREE.Color(0xc3d2f2);
      const cWarm = new THREE.Color(0xffd9a0);
      const cOuter = new THREE.Color(0x7f96e0); // 外盘沉入冷蓝：方案图的「暖核 + 冷蓝紫外围」""", 'disk-color')

s = sub(s,
"""        const warm = Math.min(1, Math.max(0, 1 - (rr / GR) * 1.6)) * (rand() * 0.6 + 0.4) * warmMix;
        const c = cCool.clone().lerp(cWarm, warm);""",
"""        const warm = Math.min(1, Math.max(0, 1 - (rr / GR) * 1.6)) * (rand() * 0.6 + 0.4) * warmMix;
        // 外盘渐入冷蓝：让盘有「内暖外冷」的色阶，而不是整片同色的灰白
        const outK = Math.min(1, Math.max(0, (rr / GR - 0.42) / 0.58)) * 0.6;
        const c = cCool.clone().lerp(cWarm, warm).lerp(cOuter, outK);""", 'disk-gradient')

# ---------- ⑤ 星云重写 ----------
start = s.index('    // ===== 星云（纯装饰，与星团/分类无关，不存储任何信息）=====')
end = s.index('    // 悬停/选中高亮环：跟着目标恒星走（星系空间里的一个精灵）')
new_nebula = u'''    // ===== 星云（纯装饰，与星团/分类无关，不存储任何信息）=====
    // 星云 = 随机但具有密度结构的微弱粒子 / 雾状光效，只负责营造宇宙空间感，不承载分类或文章信息。
    //   ① 密度结构（关键：不是均匀噪点）—— 云核（向心密、边缘疏）+ 核间丝缕 + 8% 极稀薄弥散，
    //      看起来随机，实际有空间结构；否则就是一层「粒子背景」。
    //   ② 亮度分级（每 1000 颗）：700 若有若无 / 200 轻微可见 / 80 偶尔闪 / 20 明显微光 —— 层次感的来源。
    //   ③ 极慢异速漂移（不同层不同速）+ 非同步的轻微亮度变化，绝不「闪烁」。
    //   ④ 星云可以穿过星团：它的边界必须模糊 —— 星团的边界只由恒星的空间聚集形成，
    //      否则用户会把星云误读成分类。
    let nebCloud: THREE.Points, nebDust: THREE.Points;
    {
      const rngN = mulberry32(20260929);
      const CORES = 18; // 密度场骨架：云核数量（太少 → 团块感生硬；太多 → 又变成均匀噪点）
      const PALETTE = ['#5f79c9', '#8a6fc9', '#b07a9e', '#c9a06d', '#7f8fd0', '#6fb0c4'].map((h) => new THREE.Color(h));
      const SAT = ['#4a7ce8', '#9a6fe0', '#e87fa8', '#4ac9c9', '#e8b46a'].map((h) => new THREE.Color(h));
      const cores: { x: number; y: number; z: number; rad: number; w: number; ci: number }[] = [];
      for (let c2 = 0; c2 < CORES; c2++) {
        const rr = GR * (0.34 + 0.72 * Math.sqrt(rngN()));
        const th = rngN() * Math.PI * 2;
        const rad = 2.6 + rngN() * 4.4;
        cores.push({
          x: Math.cos(th) * rr, y: Math.sin(th) * rr, z: gj() * 0.9,
          rad, w: Math.pow(rad, 1.5), ci: c2 % PALETTE.length,
        });
      }
      const wSum = cores.reduce((a, c2) => a + c2.w, 0);
      const pickCore = (u: number) => {
        let acc = 0;
        for (const c2 of cores) { acc += c2.w / wSum; if (u <= acc) return c2; }
        return cores[cores.length - 1];
      };
      const N_CLOUD = Math.round(2600 * DN); // 云雾层：中大柔斑，重叠成雾
      const N_DUST = Math.round(6600 * DN);  // 微尘层：小粒子撒在云上
      const build = (n: number, big: boolean) => {
        const arr = new Float32Array(n * 3), col = new Float32Array(n * 3);
        const sz = new Float32Array(n), pha = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const u = rngN();
          let cx2: number, cy2: number, cz2: number, base: THREE.Color;
          if (u < 0.78) {
            // 云核：向心高斯 → 云心密、向边缘指数式稀疏（「中心密度高、边缘稀疏」）
            const c2 = pickCore(rngN());
            const dr = Math.abs(gj()) * 0.62 * c2.rad;
            const th2 = rngN() * Math.PI * 2;
            cx2 = c2.x + Math.cos(th2) * dr;
            cy2 = c2.y + Math.sin(th2) * dr;
            cz2 = c2.z + (rngN() - 0.5) * 1.5;
            base = PALETTE[c2.ci];
          } else if (u < 0.92) {
            // 丝缕：两核之间连线上的游走 —— 云与云之间有稀薄的桥，才自然连成片
            const a2 = cores[Math.floor(rngN() * cores.length)];
            const b2 = cores[Math.floor(rngN() * cores.length)];
            const tt = rngN(), bend = (rngN() - 0.5) * 5.0;
            cx2 = a2.x + (b2.x - a2.x) * tt + bend;
            cy2 = a2.y + (b2.y - a2.y) * tt + bend * 0.6;
            cz2 = a2.z + (rngN() - 0.5) * 1.6;
            base = PALETTE[a2.ci];
          } else {
            // 弥散底噪：整盘极稀薄一层，保证云与云之间不出现突兀空档
            const rr = GR * (0.25 + 0.85 * Math.sqrt(rngN()));
            const th2 = rngN() * Math.PI * 2;
            cx2 = Math.cos(th2) * rr; cy2 = Math.sin(th2) * rr; cz2 = gj() * 1.1;
            base = PALETTE[Math.floor(rngN() * PALETTE.length)];
          }
          arr[i * 3] = cx2; arr[i * 3 + 1] = cy2; arr[i * 3 + 2] = cz2;
          // ---- 亮度分级：700 / 200 / 80 / 20（每 1000 颗）----
          const roll = rngN();
          let f: number, sMul: number;
          if (roll < 0.70)      { f = 0.05 + rngN() * 0.08; sMul = 0.9; }  // 700：若有若无
          else if (roll < 0.90) { f = 0.16 + rngN() * 0.14; sMul = 1.15; } // 200：轻微可见
          else if (roll < 0.98) { f = 0.34 + rngN() * 0.18; sMul = 1.5; }  // 80：偶尔闪一下
          else                  { f = 0.62 + rngN() * 0.33; sMul = 2.2; }  // 20：明显微光
          // 亮档混入高饱和色相：暗粒子在 additive 下只呈灰白，色相要靠亮粒子显现
          const mixC = roll >= 0.98 ? base.clone().lerp(SAT[Math.floor(rngN() * SAT.length)], 0.6) : base;
          col[i * 3] = mixC.r * f; col[i * 3 + 1] = mixC.g * f; col[i * 3 + 2] = mixC.b * f;
          sz[i] = (big ? 0.55 + rngN() * 0.6 : 0.22 + rngN() * 0.38) * sMul;
          pha[i] = rngN() * Math.PI * 2;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
        g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
        g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
        g.setAttribute('aPhase', new THREE.BufferAttribute(pha, 1));
        g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), GR * 1.7);
        return g;
      };
      // ① 云雾层：中大柔斑、单粒极淡，靠重叠成雾
      nebCloud = new THREE.Points(build(N_CLOUD, true), galaxyMat(1.5, 0.26, 30, { churn: 0.0009 }));
      // ★ 加性混合：雾只能「加光」。普通混合下暗粒子会把背景压黑（暗色覆盖亮底）
      nebCloud.material.blending = THREE.AdditiveBlending;
      galaxyTilt.add(nebCloud);
      // ② 微尘层：小粒子撒在云上；churn 更慢 → 层间错动，看不出「整片一起转」
      nebDust = new THREE.Points(build(N_DUST, false), galaxyMat(0.55, 0.85, 9, { churn: 0.0005 }));
      nebDust.material.blending = THREE.AdditiveBlending;
      galaxyTilt.add(nebDust);
    }

'''
s = s[:start] + new_nebula + s[end:]

# ---------- 主循环：边界线随探索态浮现 ----------
s = sub(s,
"""      if (linkBreath) linkBreath.uniforms.uOpacity.value = 0.05 + exploreT * (0.83 + Math.sin(t * 0.4) * 0.06); // 关系线：默认若隐若现，Explore 态清晰浮现""",
"""      if (linkBreath) linkBreath.uniforms.uOpacity.value = 0.05 + exploreT * (0.83 + Math.sin(t * 0.4) * 0.06); // 关系线：默认若隐若现，Explore 态清晰浮现
      // 星团边界：Explore 态才浮现（默认态 0），与「星云无边界」形成语义对比
      clusterBounds.material.uniforms.uOpacity.value = exploreT * (0.5 + Math.sin(t * 0.33) * 0.07);""", 'bounds-opacity')

io.open(BG, 'w', encoding='utf-8', newline='').write(s)
io.open(IDX, 'w', encoding='utf-8', newline='').write(idx)
print('patched OK; BrainGraph %d -> %d lines' % (before[0].count('\n'), s.count('\n')))
