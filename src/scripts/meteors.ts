// 全站流星背景：轻量 canvas，低频流星 + 微闪烁星点
// 性能：视口外/标签页隐藏自动暂停；prefers-reduced-motion 静态显示
(function () {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.id = 'meteor-bg';
  Object.assign(canvas.style, {
    position: 'fixed', inset: '0', zIndex: '0',
    pointerEvents: 'none', opacity: '0.9',
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W = 0, H = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  new ResizeObserver(resize).observe(document.documentElement);

  // 静态微星（低频闪烁，与背景渐变星点叠加出层次）
  const twinkles = Array.from({ length: 40 }, (_, i) => ({
    x: Math.random(), y: Math.random(),
    r: 0.4 + Math.random() * 0.9,
    base: 0.12 + Math.random() * 0.3,
    phase: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.8,
  }));

  // 流星池：同屏最多 2 颗，随机间隔 4-11 秒划过一颗
  const meteors = [];
  function spawn() {
    const fromLeft = Math.random() < 0.6;
    meteors.push({
      x: fromLeft ? -60 : Math.random() * W * 0.7 + W * 0.3,
      y: Math.random() * H * 0.35 - 40,
      vx: (fromLeft ? 7 : 5) + Math.random() * 4,
      vy: 3.2 + Math.random() * 2.2,
      len: 90 + Math.random() * 130,
      life: 0, maxLife: 70 + Math.random() * 30,
    });
  }
  let nextSpawn = 60 + Math.random() * 120;

  let inView = true, raf = 0, frame = 0;
  new IntersectionObserver(([e]) => {
    inView = e.isIntersecting;
    if (inView && !raf) { raf = requestAnimationFrame(loop); }
  }, { threshold: 0 }).observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (inView && !raf) raf = requestAnimationFrame(loop);
  });

  function loop() {
    raf = requestAnimationFrame(loop);
    frame++;
    ctx.clearRect(0, 0, W, H);

    // 微星闪烁
    for (const s of twinkles) {
      const a = s.base * (0.6 + 0.4 * Math.sin(frame * 0.02 * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(235, 232, 224, ${a})`;
      ctx.fill();
    }

    // 流星生成
    if (--nextSpawn <= 0 && meteors.length < 2) {
      spawn();
      nextSpawn = 240 + Math.random() * 420; // 4~11 秒
    }

    // 流星绘制与回收
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx; m.y += m.vy; m.life++;
      const fade = m.life < 12 ? m.life / 12 : Math.max(0, 1 - (m.life - 12) / (m.maxLife - 12));
      const tailX = m.x - m.vx * (m.len / 10);
      const tailY = m.y - m.vy * (m.len / 10);
      const grad = ctx.createLinearGradient(m.x, m.y, tailX, tailY);
      grad.addColorStop(0, `rgba(240, 238, 228, ${0.85 * fade})`);
      grad.addColorStop(1, 'rgba(240, 238, 228, 0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      // 流星头部亮点
      ctx.beginPath();
      ctx.arc(m.x, m.y, 1.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 252, 244, ${0.9 * fade})`;
      ctx.fill();
      if (fade <= 0 || m.x > W + 200 || m.y > H + 200) meteors.splice(i, 1);
    }
  }

  if (reduced) {
    // 静态：只画一次微星，无流星无动画
    loop(); cancelAnimationFrame(raf); raf = 0;
    return;
  }
  raf = requestAnimationFrame(loop);
})();
