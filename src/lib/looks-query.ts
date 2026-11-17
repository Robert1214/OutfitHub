/**
 * 搭配列表页 URL 构造：场景标签（多值取交集）/ 关键词 / 分页。
 */
export type LooksQueryState = {
  q?: string;
  tags?: string[];
  page?: number;
};

export function buildLooksHref(
  current: LooksQueryState,
  overrides: Partial<LooksQueryState> = {},
): string {
  const next: LooksQueryState = { ...current, ...overrides };
  next.page = overrides.page;

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  for (const tag of next.tags ?? []) params.append("tag", tag);
  if (next.page && next.page > 1) params.set("page", String(next.page));

  const qs = params.toString();
  return qs ? `/looks?${qs}` : "/looks";
}

/** 切换某个标签（已存在则移除），最多 8 个 */
export function toggleLookTag(tags: string[] | undefined, tag: string): string[] {
  const list = tags ?? [];
  return list.includes(tag)
    ? list.filter((item) => item !== tag)
    : [...list, tag].slice(0, 8);
}
