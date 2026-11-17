"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CosImage } from "@/components/wardrobe/cos-image";
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
 * 非多选模式下每张卡片右上角有「⋯」菜单（编辑 / 删除）。
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
            {/* 展示的是白底图（flatKey），容器用纯白 */}
            <div
              className={cn(
                "relative aspect-[4/5] overflow-hidden rounded-xl border bg-white",
                isSelected && "ring-2 ring-primary",
              )}
            >
              <CosImage
                src={item.coverUrl}
                alt={item.name}
                loading={index < 8 ? "eager" : "lazy"}
                className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
              />

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
              ) : (
                <ItemMenu
                  itemId={item.id}
                  name={item.name}
                  index={index}
                  onDelete={() => onToggle}
                />
              )}
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

/** 卡片右上角操作菜单：编辑 / 删除 */
function ItemMenu({
  itemId,
  name,
}: {
  itemId: string;
  name: string;
  index: number;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(`确定删除「${name}」吗？图片会一并从云端删除，不可恢复。`)
    ) {
      return;
    }
    setDeleting(true);
    try {
      const response = await fetch(`/api/items/${itemId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "删除失败，请重试");
        setDeleting(false);
        return;
      }
      toast.success("已删除");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("网络异常，请重试");
      setDeleting(false);
    }
  }

  return (
    <div className="absolute right-1.5 top-1.5">
      <button
        type="button"
        aria-label="更多操作"
        onClick={(event) => {
          // 阻止冒泡到 <Link>，避免点菜单时跳走
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex size-7 items-center justify-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background"
      >
        <MoreHorizontal className="size-4" />
      </button>

      {open ? (
        <>
          {/* 点击外部关闭 */}
          <div
            className="fixed inset-0 z-10"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute right-0 z-20 mt-1 w-24 overflow-hidden rounded-lg border bg-background shadow-md">
            <Link
              href={`/items/${itemId}/edit`}
              onClick={(event) => event.stopPropagation()}
              className="block px-3 py-2 text-xs hover:bg-muted"
            >
              编辑
            </Link>
            <button
              type="button"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                void handleDelete();
              }}
              className="block w-full px-3 py-2 text-left text-xs text-destructive hover:bg-muted disabled:opacity-50"
            >
              {deleting ? "删除中…" : "删除"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
