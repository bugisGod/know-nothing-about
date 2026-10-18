// 标签注册表：后台「标签管理」发布时生成 src/data/tags.json。
// ★ Vite 静态 JSON 导入（构建期解析）——运行时 readFileSync + import.meta.url
//   在 Astro 打包后路径失效（实测教训）。仓库常驻默认 {}，后台发布时覆写。
import reg from "../data/tags.json";

export interface TagMeta { label: string; desc?: string; color?: string }
const R = reg as Record<string, TagMeta>;

/** 文章标签 key → 显示名（无注册则回退原文） */
export function tagLabel(key: string): string {
  return R[key]?.label ?? key;
}
/** 标签点色（无注册给空=默认色） */
export function tagColor(key: string): string {
  return R[key]?.color ?? "";
}
