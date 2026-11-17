"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CosImage } from "@/components/wardrobe/cos-image";
import { CATEGORY_LABELS, type ItemCategoryValue } from "@/lib/validations/wardrobe";
import { cn } from "@/lib/utils";

export type NewItemCard = {
  id: string;
  name: string;
  category: ItemCategoryValue;
  brand: string | null;
  coverUrl: string | null;
  tags: { id: string; name: string }[];
  tried: boolean;
};

type Props = {
  items: NewItemCard[];
};

/**
 * New 区卡片网格：
 * - 手机 1 列（带操作按钮），桌面 2~3 列
 * - 操作：移入衣橱 / 加入搭配 / 试穿
 */
export function NewItemGrid({ items }: Props) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id}>
          <NewItemCardView item={item} />
        </li>
      ))}
    </ul>
  );
}

function NewItemCardView({ item }: { item: NewItemCard }) {
  const router = useRouter();
  const [moving, setMoving] = useState(false);
  const [moved, setMoved] = useState(false);

  async function moveToWardrobe() {
    setMoving(true);
    try {
      const response = await fetch(`/api/items/${item.id}/zone`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone: "WARDROBE" }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "移动失败，请重试");
        return;
      }
      setMoved(true);
      toast.success(`「${item.name}」已移入衣橱`);
      router.refresh();
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setMoving(false);
    }
  }

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border p-3 transition-opacity",
        moved && "opacity-50",
      )}
    >
      <Link
        href={`/items/${item.id}`}
        className="block size-24 shrink-0 overflow-hidden rounded-lg border bg-white"
      >
        <CosImage
          src={item.coverUrl}
          alt={item.name}
          className="h-full w-full object-contain"
        />
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {CATEGORY_LABELS[item.category]}
            </Badge>
            <Badge
              variant={item.tried ? "secondary" : "outline"}
              className="text-[10px]"
            >
              {item.tried ? "已试穿" : "待试穿"}
            </Badge>
          </div>
          <Link
            href={`/items/${item.id}`}
            className="line-clamp-1 text-sm font-medium hover:underline"
          >
            {item.name}
          </Link>
          {item.brand ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {item.brand}
            </p>
          ) : null}
          {item.tags.length > 0 ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {item.tags.slice(0, 3).map((t) => `#${t.name}`).join(" ")}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="default"
            disabled={moving || moved}
            onClick={moveToWardrobe}
            className="h-7 px-2 text-[11px]"
          >
            {moving ? "移动中…" : moved ? "已移入" : "移入衣橱"}
          </Button>
          <Link
            href={`/looks/new?items=${item.id}`}
            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2 text-[11px] hover:bg-muted"
          >
            加入搭配
          </Link>
          <Link
            href={`/tryon?itemId=${item.id}`}
            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2 text-[11px] hover:bg-muted"
          >
            试穿
          </Link>
        </div>
      </div>
    </div>
  );
}
