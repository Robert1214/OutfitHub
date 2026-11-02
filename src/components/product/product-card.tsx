import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import type { ProductCardData } from "@/lib/products";
import { cn } from "@/lib/utils";

const refTypeLabel: Record<ProductCardData["refType"], string> = {
  GARMENT: "服装",
  ACCESSORIES: "配饰",
  SHOES: "鞋履",
};

export function ProductCard({ product }: { product: ProductCardData }) {
  const image = product.images[0]?.url;
  const sold = product.status === "SOLD";

  return (
    <Link href={`/products/${product.slug}`} className="group block">
      <div className="relative aspect-[4/5] overflow-hidden rounded-xl border bg-muted">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className={cn(
              "object-contain transition-transform duration-300 group-hover:scale-105",
              sold && "opacity-60 grayscale",
            )}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            暂无图片
          </div>
        )}

        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge variant={sold ? "secondary" : "default"}>
            {sold ? "已售出" : "仅此一件"}
          </Badge>
          {product.refType !== "GARMENT" ? (
            <Badge variant="outline" className="bg-background/80 backdrop-blur">
              {refTypeLabel[product.refType]}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1">
        <p className="text-xs text-muted-foreground">{product.category.name}</p>
        <h3 className="line-clamp-1 text-sm font-medium">{product.name}</h3>
        <p className="text-sm">{formatPrice(product.priceCents)}</p>
        {product.tags.length > 0 ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">
            {product.tags
              .slice(0, 2)
              .map((tag) => `#${tag}`)
              .join(" ")}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
