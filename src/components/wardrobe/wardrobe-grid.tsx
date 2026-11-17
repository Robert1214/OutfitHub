"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, type ItemCategoryValue } from "@/lib/validations/wardrobe";
import { cn } from "@/lib/utils";

export type WardrobeCardItem = {
  id: string;
  name: string;
  category: ItemCategoryValue;
  brand: string | null;
  coverUrl: string | null;
  tags: { id: string; name: string }[];
};

type Props = {
  items: WardrobeCardItem[];
  /** 多选模式（勾选后生成搭配） */
  selected?: string[];
  onToggle?: (id: string) => void;
};

/**
 * 单品网格：手机 2 列 / 平板 3 列 / 桌面 4 列。
 * 选中模式下卡片点击变成勾选，右下角显示序号（对应画布中的顺序）。
 */
export function WardrobeGrid({ items, selected = [], onToggle }: Props) {
  const selecting = Boolean(onToggle);

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((item, index) => {
        const selectedIndex = selected.indexOf(item.id);
        const isSelected = selectedIndex !== -1;

        const body = (
          <>
            {/* 展示的是白底图（flatKey），容器用纯白，避免出现"棋盘格留边" */}
            <div
              className={cn(
                "relative aspect-[4/5] overflow-hidden rounded-xl border bg-white",
                isSelected && "ring-2 ring-primary",
              )}
            >
              {item.coverUrl ? (
                // 签名 URL 域名随 COS 桶变化，用原生 img 避免配置 remotePatterns
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.coverUrl}
                  alt={item.name}
                  loading={index < 8 ? "eager" : "lazy"}
                  className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  图片加载失败
                </div>
              )}

              <Badge
                variant="outline"
                className="absolute left-2 top-2 bg-background/85 text-[10px] backdrop-blur"
              >
                {CATEGORY_LABELS[item.category]}
              </Badge>

              {selecting ? (
                <span
                  className={cn(
                    "absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border text-xs",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background/85 text-transparent",
                  )}
                >
                  {isSelected ? selectedIndex + 1 : "✓"}
                </span>
              ) : null}
            </div>

            <div className="mt-2.5 space-y-1">
              <h3 className="line-clamp-1 text-sm font-medium">{item.name}</h3>
              {item.brand ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {item.brand}
                </p>
              ) : null}
              {item.tags.length > 0 ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {item.tags
                    .slice(0, 3)
                    .map((tag) => `#${tag.name}`)
                    .join(" ")}
                </p>
              ) : null}
            </div>
          </>
        );

        return (
          <li key={item.id}>
            {selecting ? (
              <button
                type="button"
                onClick={() => onToggle?.(item.id)}
                className="group block w-full text-left"
                aria-pressed={isSelected}
              >
                {body}
              </button>
            ) : (
              <Link href={`/items/${item.id}`} className="group block">
                {body}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
