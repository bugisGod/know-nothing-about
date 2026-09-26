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
export const SERIES: Record<string, { title: string; color?: string }> = {
  'ai-agent-book': { title: '深入理解 AI Agent', color: '#9db8ff' },
};

// 知识库分类的展示信息：文件夹名 → 中文名 + 一句话描述 + 域色
// 用于星图锚星标签、图例、知识库分区标题；没配置的分类回退显示文件夹名
export const CATEGORIES: Record<string, { label: string; desc: string; color?: string }> = {
  study: { label: '学习笔记', desc: '读书 · 源码 · 实践对照', color: '#9db8ff' },
  frontend: { label: '前端', desc: '框架 · 工程化 · 浏览器', color: '#ffe3b3' },
};
