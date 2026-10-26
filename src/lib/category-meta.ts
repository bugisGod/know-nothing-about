// 分类元信息注册表：显示名 / 一句话描述 / 域色覆盖 / 形态覆盖种子。
//
// ★ 为什么存在（2026-10-26）：这些字段原先只有 src/config.ts 的 CATEGORIES 一份，
//   写死在代码里——新分类的中文名和描述都得改码重部署，后台碰不到。
//   现在照「标签注册表」的同款链路搬到后台：admin 的 categories 表 → 发布时导出
//   本目录的 categories.json → 站点构建期静态导入（与 tags.ts 一致：运行时
//   readFileSync + import.meta.url 在 Astro 打包后路径失效，实测教训）。
//
// 合并规则：代码里的 CATEGORIES 是兜底默认值，注册表逐字段覆盖。
//   → 后台没配过的分类，行为与改动前逐比特一致。
import reg from "../data/categories.json";
import { CATEGORIES } from "../config";

export interface CategoryMeta {
  label: string;
  desc: string;
  color?: string;
  shape?: string;
}

const R = reg as Record<string, Partial<CategoryMeta>>;

/** 分类 key（小写）→ 合并后的展示信息 */
export function categoryRegistry(): Record<string, CategoryMeta> {
  const out: Record<string, CategoryMeta> = {};
  for (const key of new Set([...Object.keys(CATEGORIES), ...Object.keys(R)])) {
    const base = CATEGORIES[key];
    const over = R[key] ?? {};
    out[key] = {
      label: over.label ?? base?.label ?? key,
      desc: over.desc ?? base?.desc ?? "",
      color: over.color ?? base?.color,
      shape: over.shape ?? base?.shape,
    };
  }
  return out;
}
