"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  addToCart,
  CART_UPDATED_EVENT,
} from "@/lib/cart";

type AddToCartProduct = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  status: "DRAFT" | "ON_SALE" | "SOLD" | "ARCHIVED";
  images: { url: string }[];
};

export function AddToCartButton({ product }: { product: AddToCartProduct }) {
  const { data: session } = useSession();
  const [pending, setPending] = useState(false);
  const sold = product.status === "SOLD";

  async function handleClick() {
    setPending(true);

    if (session?.user) {
      try {
        const response = await fetch("/api/cart", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", productId: product.id }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          added?: boolean;
          error?: string;
        };

        if (!response.ok) {
          toast.error(data.error ?? "加入购物车失败，请稍后重试");
        } else if (data.added) {
          toast.success("已加入购物车");
        } else {
          toast.info("这件已经在购物车里了");
        }
        window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      } catch {
        toast.error("加入购物车失败，请稍后重试");
      } finally {
        setPending(false);
      }
      return;
    }

    const result = addToCart({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      priceCents: product.priceCents,
      imageUrl: product.images[0]?.url ?? null,
    });

    if (result === "added") {
      toast.success("已加入购物车");
    } else {
      toast.info("这件已经在购物车里了");
    }
    setPending(false);
  }

  return (
    <Button
      size="lg"
      className="w-full"
      disabled={sold || pending}
      onClick={() => void handleClick()}
    >
      {sold ? "已售出" : "加入购物车"}
    </Button>
  );
}
