// ===== 全站个人信息：改这一个文件，全站生效 =====
export const SITE = {
  // 站点名（浏览器标签页 / 页头 Logo）
  title: 'scio',

  // 作者名：首页大标题、页脚署名
  author: 'scio',

  // 一句话介绍（首页副标题）
  tagline: 'I know that I know nothing.',

  // 关于页自我介绍
  bio: [
    '开发者 / 长期学习者。',
    '毕业于西安石油大学，五年工作经验的菜鸟程序员：用 Python 写过后端，现在搞编译相关的工作。',
    '热爱 vibe coding，喜欢搞一些奇奇怪怪但不太有用的东西。',
  ].join('\n'),

  // 社交链接（icon 可选：github / mail / rss / link）
  socials: [
    { label: 'GitHub', url: 'https://github.com/bugisGod', icon: 'github' },
    { label: 'Email', url: 'mailto:1405034491@qq.com', icon: 'mail' },
    { label: 'RSS', url: '/rss.xml', icon: 'rss' },
  ],

  // 页脚起始年份
  since: 2026,
};

// 专栏：series slug → 展示名 + 域色（恒星色温系，星图锚星用）
export const SERIES: Record<string, { title: string; color?: string; desc?: string }> = {
  'ai-agent-book': {
    title: '深入理解 AI Agent',
    color: '#9db8ff',
    desc: '从大脑、眼睛与手脚开始拆解 Agent，涵盖原理、工具、实现与工程实践。',
  },
};

// 知识库分类的展示信息：文件夹名 → 中文名 + 一句话描述 + 域色
// ★ 全部可选——这是「覆盖位」不是「必填项」：没配置的分类自动走 autoColor（哈希取色）
//   + 文件夹名当显示名。框架化目标：新增分类 = 建文件夹放文章，其余零操作。
export const CATEGORIES: Record<string, { label: string; desc: string; color?: string }> = {
  frontend: { label: '前端', desc: '框架 · 工程化 · 浏览器', color: '#a892d8' },
};

// 自动域色色板：色相每 36° 一档均匀铺满色轮，柔和高饱和（暗夜空环境可辨）
// ★ 色相均匀是关键 —— 旧色板琥珀/淡金/陶土挤在 30-45°、雾紫/淡紫挤在一起，
//   多团分配时必然近色。与手动配置色（雾蓝220/雾紫262/项目琥珀38）近的档由去重逻辑自动跳过
export const AUTO_PALETTE = [
  '#d98f8f', // 0° 玫瑰红
  '#d9b26b', // 36° 琥珀金
  '#b8c26b', // 72° 橄榄黄
  '#8fc27a', // 108° 草绿
  '#7ac2a0', // 144° 青绿
  '#7ac2c2', // 180° 青
  '#7a9cc2', // 216° 蓝
  '#968fc2', // 252° 蓝紫
  '#b58fc2', // 288° 紫
  '#c28fa8', // 324° 粉
];
// ★ 扩容段（2026-10-26 审查 P1）：18° 间隔 10 档。**必须独立于 AUTO_PALETTE**——
//   直接追加进主色板会改变哈希遍历顺序，已分配的自动色团会换色（实测 ai
//   #8fc27a → #81cf89，违反「老团永不换色」红线）。pickColorFromPalette 两段式：
//   主色板耗尽才轮到本段。
export const AUTO_PALETTE_EXTRA = [
  '#cf9981', // 18° 陶土
  '#cfc881', // 54° 沙金
  '#a8cf81', // 90° 嫩绿
  '#81cf89', // 126° 苔绿
  '#81cfb8', // 162° 薄荷
  '#81b8cf', // 198° 湖蓝
  '#8189cf', // 234° 鸢尾蓝
  '#a881cf', // 270° 紫罗兰
  '#cf81c8', // 306° 海棠紫
  '#cf8199', // 342° 绯粉
];
// 项目团固定色（纳入自动分配的占用表，防止自动色与它撞色）
export const PROJECT_COLOR = '#ffc46b';

export const hueOf = (hex: string): number => {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx === mn) return -1;
  const d = mx - mn;
  let h: number;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return (h * 60 + 360) % 360;
};

// ★ 纯探针取色：key 哈希定起点，已占用/近色相（<20°）跳过，色板耗尽取「距离最大」候选。
//   分配与记录由下方 assignClusterColors 无状态完成（新团只从未占用色里挑，老团永不换色）
//   ★ 两段式色板（2026-10-26）：第一段 AUTO_PALETTE 与历史行为逐比特一致（遍历顺序
//   变了会移动已分配团的颜色，实测踩过）；第二段 AUTO_PALETTE_EXTRA 仅在一段耗尽后参与。
export const pickColorFromPalette = (
  key: string,
  usedHex: Set<string>,
  usedHues: number[],
): string => {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const stages = [AUTO_PALETTE, AUTO_PALETTE_EXTRA];
  for (const stage of stages) {
    const base = h % stage.length;
    let picked: string | null = null;
    for (let t = 0; t < stage.length; t++) {
      const cand = stage[(base + t) % stage.length];
      if (usedHex.has(cand.toLowerCase())) continue;
      const hu = hueOf(cand);
      const dist = hu >= 0 && usedHues.length ? Math.min(...usedHues.map((uh) => Math.min(Math.abs(uh - hu), 360 - Math.abs(uh - hu)))) : 999;
      if (hu >= 0 && usedHues.length && dist < 20) continue;
      picked = cand;
      break;
    }
    if (picked) return picked;
  }
  // 两段都无「未占用且非近色」候选：全色板里取色相距离最大的未占用色
  let best: string | null = null, bestDist = -1;
  for (const stage of stages) {
    const base = h % stage.length;
    for (let t = 0; t < stage.length; t++) {
      const cand = stage[(base + t) % stage.length];
      if (usedHex.has(cand.toLowerCase())) continue;
      const hu = hueOf(cand);
      const dist = hu >= 0 && usedHues.length ? Math.min(...usedHues.map((uh) => Math.min(Math.abs(uh - hu), 360 - Math.abs(uh - hu)))) : 999;
      if (dist > bestDist) { bestDist = dist; best = cand; }
    }
  }
  return best ?? AUTO_PALETTE[h % AUTO_PALETTE.length];
};

export interface ClusterColorRequest {
  key: string;
  /** 手动配置色（可选）：最高优先，永不改变 */
  color?: string;
  /** 出生日期（该团最早文章的日期）：决定分配顺序 —— 新团按时间自然排在队尾 */
  birth?: string;
}

// ★ 无状态全局分配（框架核心）：同一份内容永远算出同一套颜色，无文件无记录。
//   规则：按出生日期从早到晚依次取色（哈希起点 + 色相距离 <20° 跳过 + 兜底最大距离），
//   手动配置色优先且永占其位。保证：新增团排在队尾自动避开所有已有色 → 已有团永不因新增而变色。
export const assignClusterColors = (
  requests: ClusterColorRequest[],
  reserved: string[] = [],
): Record<string, string> => {
  const usedHex = new Set(reserved.map((c) => c.toLowerCase()));
  const usedHues = reserved.map(hueOf).filter((h) => h >= 0);
  const out: Record<string, string> = {};
  const order = [...requests].sort((a, b) => {
    const ba = a.birth ?? "9999-99-99", bb = b.birth ?? "9999-99-99";
    if (ba !== bb) return ba < bb ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
  for (const r of order) {
    if (r.color) {
      out[r.key] = r.color; // 手动配置：原样保留并登记占用
    } else {
      out[r.key] = pickColorFromPalette(r.key, usedHex, usedHues);
    }
    usedHex.add(out[r.key].toLowerCase());
    const hu = hueOf(out[r.key]);
    if (hu >= 0) usedHues.push(hu);
  }
  return out;
};
