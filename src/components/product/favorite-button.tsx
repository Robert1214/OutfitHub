"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  productId,
  slug,
  initialFavorited,
  isLoggedIn,
}: {
  productId: string;
  slug: string;
  initialFavorited: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (!isLoggedIn) {
      toast.info("登录后可以收藏");
      router.push(
        `/login?next=${encodeURIComponent(`/products/${slug}`)}`,
      );
      return;
    }
    if (busy) return;

    setBusy(true);
    try {
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        favorited?: boolean;
        error?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          router.push(
            `/login?next=${encodeURIComponent(`/products/${slug}`)}`,
          );
          return;
        }
        toast.error(data.error ?? "操作失败，请稍后重试");
        return;
      }

      const next = Boolean(data.favorited);
      setFavorited(next);
      toast.success(next ? "已收藏" : "已取消收藏");
    } catch {
      toast.error("操作失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label={favorited ? "取消收藏" : "收藏"}
      aria-pressed={favorited}
      title={favorited ? "取消收藏" : "收藏"}
      disabled={busy}
      onClick={() => void toggle()}
      className={cn(
        "shrink-0",
        favorited &&
          "border-amber-300 text-amber-400 hover:text-amber-500",
      )}
    >
      <Star className={cn("size-5", favorited && "fill-current")} />
    </Button>
  );
}
