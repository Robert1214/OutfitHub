"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  item: {
    id: string;
    name: string;
  };
};

/** 详情页操作区：编辑 / 加入搭配 / 试穿这件 / 删除 */
export function ItemActions({ item }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `确定删除「${item.name}」吗？图片也会一并从云端删除，且不可恢复。`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/items/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "删除失败，请重试");
        return;
      }
      toast.success("已删除");
      router.push("/wardrobe");
      router.refresh();
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/items/${item.id}/edit`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        编辑
      </Link>
      <Link
        href={`/tryon?itemId=${item.id}`}
        className={buttonVariants({ variant: "default", size: "sm" })}
      >
        试穿这件
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={handleDelete}
        className="text-destructive hover:text-destructive"
      >
        {busy ? "删除中…" : "删除"}
      </Button>
    </div>
  );
}

export function CategoryBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(className)}>
      {label}
    </Badge>
  );
}
