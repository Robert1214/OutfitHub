"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addToCart } from "@/lib/cart";

type AddToCartProduct = {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  status: "DRAFT" | "ON_SALE" | "SOLD" | "ARCHIVED";
  images: { url: string }[];
};

export function AddToCartButton({ product }: { product: AddToCartProduct }) {
  const [pending, setPending] = useState(false);
  const sold = product.status === "SOLD";

  function handleClick() {
    setPending(true);
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
      onClick={handleClick}
    >
      {sold ? "已售出" : "加入购物车"}
    </Button>
  );
}
