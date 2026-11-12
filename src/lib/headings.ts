// 详情页目录（ArticleToc）用的标题抽取：从已渲染的正文 HTML 里取 h1~h6 的锚点与文本。
// 2026-11-12 抽出：此前 projects/[slug].astro 与 notes/[...slug].astro 各写一遍正则，
// 且两处都把 text 写死成 '' → 线上目录是 8 个点不到的空链接。单一事实来源后不会再漂移。
export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const cp = name[1] === "x" || name[1] === "X"
        ? parseInt(name.slice(2), 16)
        : parseInt(name.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : whole;
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

/** 与 renderMarkdown 的 rehypeHeadingIds 输出同构：<h2 id="...">文本</h2> */
export function extractHeadings(html: string): Heading[] {
  const re = /<h([1-6])\b[^>]*\bid="([^"]*)"[^>]*>([\s\S]*?)<\/h[1-6]>/gi;
  return [...html.matchAll(re)].map((m) => ({
    depth: Number(m[1]),
    slug: decodeEntities(m[2]),
    text: decodeEntities(m[3].replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim(),
  }));
}
