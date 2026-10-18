// Markdown → HTML：复刻 Astro 管线（GFM + shiki vesper wrap + github-slugger 标题锚点）
// 验收门：输出与静态构建的文章正文归一化后 100% 相等（md-diff-test 验证过）
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";
import { codeToHtml } from "shiki";

async function hl(code: string, lang: string) {
  return codeToHtml(code, { lang: lang || "text", theme: "vesper", wrap: true });
}

function rehypeShikiAstro() {
  return async (tree: any) => {
    const jobs: Promise<void>[] = [];
    const visit = (node: any) => {
      for (const child of node.children || []) visit(child);
      if (node.tagName !== "pre") return;
      const codeEl = node.children?.[0];
      if (!codeEl || codeEl.tagName !== "code") return;
      const cls = (codeEl.properties?.className as string[] | undefined) || [];
      const lang = cls.find((c) => c.startsWith("language-"))?.slice(9) || "text";
      const raw = codeEl.children?.[0]?.value ?? "";
      jobs.push((async () => {
        const out = await hl(raw, lang);
        const m = out.match(/^<pre ([^>]*)>([\s\S]*)<\/pre>$/);
        node.tagName = "pre";
        node.properties = {};
        const attrs = m ? m[1] : "";
        const classM = attrs.match(/class="([^"]*)"/);
        const styleM = attrs.match(/style="([^"]*)"/);
        const clsAstro = (classM?.[1] || "").replace("shiki", "astro-code");
        node.properties.className = clsAstro.split(/\s+/).filter(Boolean);
        if (styleM) node.properties.style = styleM[1] + "; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word;";
        node.properties.tabIndex = 0;
        node.properties["data-language"] = lang;
        node.children = [{ type: "raw", value: m ? m[2] : raw }];
      })());
    };
    visit(tree);
    await Promise.all(jobs);
  };
}

function rehypeHeadingIds() {
  const slugger = new GithubSlugger();
  return (tree: any) => {
    const visit = (node: any) => {
      for (const child of node.children || []) visit(child);
      if (!/^h[1-6]$/.test(node.tagName || "")) return;
      if (node.properties?.id) return;
      const text = (node.children || []).map((c: any) => (c.type === "text" ? c.value : "")).join("");
      node.properties = node.properties || {};
      node.properties.id = slugger.slug(text);
    };
    visit(tree);
  };
}

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeShikiAstro)
  .use(rehypeHeadingIds)
  .use(rehypeStringify, { allowDangerousHtml: true });

export async function renderMarkdown(md: string): Promise<string> {
  const out = await processor.process(md);
  // Astro 序列化的表格空白差异（视觉无感，为对齐静态输出归一）
  let html = String(out);
  html = html.replace(/(<\/(?:thead|tbody|tr|th|td)>|<(?:table|thead|tbody|tr|th|td)[^>]*>|<\/table>)\s+(?=<)/g, "$1");
  html = html.replace(/<\/table>(?=<)/g, "</table> ");
  // 新版 shiki 结尾换行多产的空行 span（旧版没有）
  html = html.replace(/\s*<span class="line"><\/span>\s*(<\/code>)/g, "$1");
  return html;
}
