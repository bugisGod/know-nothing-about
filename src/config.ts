// ===== 全站个人信息：改这一个文件，全站生效 =====
export const SITE = {
  // 站点名（浏览器标签页 / 页头 Logo）
  title: 'scio',

  // 作者名：首页大标题、页脚署名
  author: 'yb',

  // 一句话介绍（首页副标题）
  tagline: 'I know that I know nothing.',

  // 首页自我介绍（会按行显示）
  bio: [
    '开发者 / 长期学习者。',
    '这个站点是我的个人名片，也是我的第二大脑：',
    '存放知识笔记与项目复盘，把踩过的坑变成下次的垫脚石。',
  ].join('\n'),

  // 技能标签（首页展示）
  skills: ['JavaScript / TypeScript', '前端 / 全栈', 'Node.js', '持续学习中'],

  // 社交链接（icon 可选：github / mail / rss / link）
  socials: [
    { label: 'GitHub', url: 'https://github.com/bugisGod', icon: 'github' },
    { label: 'Email', url: 'mailto:1405034491@qq.com', icon: 'mail' },
    { label: 'RSS', url: '/rss.xml', icon: 'rss' },
  ],

  // 页脚起始年份
  since: 2026,
};

// 知识库分类的展示信息：文件夹名 → 中文名 + 一句话描述
// 用于星图锚星标签、图例、知识库分区标题；没配置的分类回退显示文件夹名
export const CATEGORIES: Record<string, { label: string; desc: string }> = {
  frontend: { label: '前端', desc: '框架 · 工程化 · 浏览器' },
  tools: { label: '工具', desc: '命令行与效率工具' },
  reading: { label: '阅读', desc: '读书与方法论笔记' },
  projects: { label: '项目', desc: '做过的东西与踩过的坑' },
};
