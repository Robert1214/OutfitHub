/**
 * 衣橱页 URL 构造：分类 / 标签（多值）/ 关键词 / 排序 / 分页。
 * 所有筛选都走 URL，保证刷新、分享、返回都保持状态。
 */
import type { ItemCategoryValue, ItemZoneValue } from "@/lib/validations/wardrobe";

export type WardrobeQueryState = {
  q?: string;
  category?: ItemCategoryValue;
  zone?: ItemZoneValue;
  tags?: string[];
  sort?: "newest" | "name";
  page?: number;
};

export function buildWardrobeHref(
  current: WardrobeQueryState,
  overrides: Partial<WardrobeQueryState> & { resetPage?: boolean } = {},
): string {
  const next: WardrobeQueryState = { ...current, ...overrides };
  if (overrides.resetPage !== false) next.page = undefined;

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.zone && next.zone !== "WARDROBE") params.set("zone", next.zone);
  for (const tag of next.tags ?? []) params.append("tag", tag);
  if (next.sort && next.sort !== "newest") params.set("sort", next.sort);
  if (next.page && next.page > 1) params.set("page", String(next.page));

  const qs = params.toString();
  return qs ? `/wardrobe?${qs}` : "/wardrobe";
}

/** 切换某个标签（已存在则移除） */
export function toggleTag(tags: string[] | undefined, tag: string): string[] {
  const list = tags ?? [];
  return list.includes(tag)
    ? list.filter((item) => item !== tag)
    : [...list, tag].slice(0, 8);
}
