import Link from "next/link";
import {
  buildWardrobeHref,
  toggleTag,
  type WardrobeQueryState,
} from "@/lib/wardrobe/query";
import type { TagSummary } from "@/lib/wardrobe/tags";
import { cn } from "@/lib/utils";

type Props = {
  tags: TagSummary[];
  current: WardrobeQueryState;
  /** 目标页面，默认 /wardrobe；New 区传 /new */
  basePath?: string;
};

/** 标签筛选项：多选取交集，已选的置顶并用实心样式 */
export function TagFilter({ tags, current, basePath = "/wardrobe" }: Props) {
  const chosen = current.tags ?? [];
  if (tags.length === 0) return null;

  // 已选标签即使在列表里靠后也要显示在前面
  const sorted = [...tags].sort((a, b) => {
    const aChosen = chosen.includes(a.name) ? 1 : 0;
    const bChosen = chosen.includes(b.name) ? 1 : 0;
    if (aChosen !== bChosen) return bChosen - aChosen;
    return b.useCount - a.useCount;
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">标签筛选</p>
        {chosen.length > 0 ? (
          <Link
            href={buildWardrobeHref(current, { tags: undefined }, basePath)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            清空
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {sorted.slice(0, 24).map((tag) => {
          const active = chosen.includes(tag.name);
          return (
            <Link
              key={tag.id}
              href={buildWardrobeHref(
                current,
                { tags: toggleTag(chosen, tag.name) },
                basePath,
              )}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted",
              )}
            >
              {tag.name}
              <span
                className={cn(
                  "ml-1",
                  active ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {tag.useCount}
              </span>
            </Link>
          );
        })}
      </div>

      {chosen.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          已选 {chosen.length} 个标签，只显示同时包含它们的单品
        </p>
      ) : null}
    </div>
  );
}
