// 首页银河数据：从 posts 表实时构建（逻辑与原静态版逐行同构——视觉零变化的保证）
import { CATEGORIES, PROJECT_COLOR, assignClusterColors } from "../config";
import { listNotes, listProjects } from "./posts";

export interface ClusterDef {
  key: string; title: string; url: string; color?: string; desc?: string;
  shape?: string;
  count: number; form?: string; topics?: number; topicList?: string[];
}
export interface StarDef {
  id: string; title: string; url: string; kind: string; group: string;
  tags: string[]; desc?: string; date?: string; cluster: string;
  recent?: boolean; pinned?: boolean; related?: string[];
}

export async function buildGalaxyData() {
  const allNotes = listNotes();
  const allProjects = listProjects();

  const fmtDate = (d?: Date | string) => {
    if (!d) return "";
    const x = new Date(d);
    return `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, "0")}.${String(x.getDate()).padStart(2, "0")}`;
  };
  const isRecent = (d?: Date | string) => !!d && Date.now() - new Date(d).getTime() < 45 * 86400e3;

  const clusters: ClusterDef[] = [];
  const clusterIdx = new Map<string, number>();
  const ensureCluster = (key: string, init: Omit<ClusterDef, "count">) => {
    let i = clusterIdx.get(key);
    if (i === undefined) {
      i = clusters.length;
      clusterIdx.set(key, i);
      clusters.push({ ...init, count: 0 });
    }
    return i;
  };

  const stars: StarDef[] = [];
  const births: Record<string, string> = {};
  const noteBirth = (k: string, d?: Date | string) => {
    const b = d ? new Date(d).toISOString().slice(0, 10) : "9999-99-99";
    if (!births[k] || b < births[k]) births[k] = b;
  };

  for (const n of allNotes) {
    const cat = n.id.includes("/") ? n.id.split("/")[0] : "未分类";
    // ★ 空 category 防护（2026-10-26 审查 P2）：后台漏填分类时 id=/slug → split[0]=""
    //   → 会生成 key="cat:" 的无名空星团。跳过之（正常内容不存在此形态，纯防御）
    if (!cat) continue;
    const meta = CATEGORIES[cat];
    const key = `cat:${cat}`;
    const ci = ensureCluster(key, {
      key,
      title: meta?.label ?? cat,
      url: `/notes/?category=${encodeURIComponent(cat)}`,
      color: meta?.color,
      desc: meta?.desc,
      shape: meta?.shape,
    });
    clusters[ci].count++;
    noteBirth(key, n.data.date);
    stars.push({
      id: n.id,
      title: n.data.title,
      url: `/notes/${n.id}/`,
      kind: "笔记",
      group: clusters[ci].title,
      tags: n.data.tags,
      desc: n.data.description ?? "",
      date: fmtDate(n.data.date),
      cluster: key,
      recent: isRecent(n.data.date),
      related: n.data.related,
      pinned: n.data.pinned === true,
    });
  }

  for (const p of allProjects) {
    const ci = ensureCluster("projects", {
      key: "projects",
      title: "项目",
      url: "/projects/",
      color: PROJECT_COLOR,
      desc: "做完的东西 · 复盘",
      form: "scatter",
    });
    clusters[ci].count++;
    noteBirth("projects", p.data.date);
    stars.push({
      id: p.id,
      title: p.data.title,
      url: `/projects/${p.id}/`,
      kind: "项目",
      group: "项目",
      tags: p.data.tags.length ? p.data.tags : p.data.tech,
      desc: p.data.description,
      date: fmtDate(p.data.date),
      cluster: "projects",
      recent: isRecent(p.data.date),
    });
  }

  const links: { a: number; b: number; w: number }[] = [];
  {
    const findStar = (slug: string) =>
      stars.findIndex((s) => s.id === slug || s.id.endsWith("/" + slug));
    const manualBy = new Map<number, number[]>();
    stars.forEach((s, i) => {
      const rel = (s as { related?: string[] }).related;
      if (!rel?.length) return;
      const targets = rel.map(findStar).filter((j) => j >= 0 && j !== i);
      if (targets.length) manualBy.set(i, targets);
    });
    manualBy.forEach((targets, i) => {
      for (const j of targets) links.push({ a: Math.min(i, j), b: Math.max(i, j), w: 3 });
    });
  }

  {
    // ★ reserved=[PROJECT_COLOR]（2026-10-26 审查实锤）：此前未传，首页配色没把项目团
    //   琥珀 38° 记入占用——新分类 birth 早于项目团时，首页可能取到 36° 琥珀金而知识库
    //   不会（math/life/python/rust 四例实锤异色）。与知识库列表页同款传参。
    const assigned = assignClusterColors(
      clusters.map((c) => ({ key: c.key, color: c.color, birth: births[c.key] })),
      [PROJECT_COLOR],
    );
    for (const c of clusters) c.color = assigned[c.key];
  }

  clusters.forEach((c) => {
    const tally = new Map<string, number>();
    stars.filter((st) => st.cluster === c.key).forEach((st) => st.tags.forEach((t) => tally.set(t, (tally.get(t) ?? 0) + 1)));
    c.topics = tally.size;
    c.topicList = [...tally.entries()].sort((x, y) => y[1] - x[1]).map(([t]) => t);
  });

  const listGroups = clusters.map((c) => ({
    title: c.title,
    url: c.url,
    count: c.count,
    entries: stars.filter((s) => s.cluster === c.key).map((s) => ({ title: s.title, url: s.url, date: s.date })),
  }));

  return { clusters, stars, links, listGroups };
}
