"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import type { ProductCardData } from "@/lib/products";

export function ExpandableProductGrid({
  products,
  initialCount = 8,
  step = 8,
}: {
  products: ProductCardData[];
  initialCount?: number;
  step?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const visible = products.slice(0, visibleCount);
  const hasMore = visibleCount < products.length;

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>

      {hasMore ? (
        <div className="mt-10 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 rounded-full"
            onClick={() => setVisibleCount((count) => count + step)}
            aria-label="展开更多商品"
            title="展开更多商品"
          >
            <ChevronDown className="size-5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
