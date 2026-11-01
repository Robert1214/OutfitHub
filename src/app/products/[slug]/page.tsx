import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { ProductGallery } from "@/components/product/product-gallery";
import { ProductSizeTable } from "@/components/product/product-size-table";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import { getProductBySlug, getProductSlugs } from "@/lib/products";

export const instant = false;

const getProduct = cache(getProductBySlug);

export async function generateStaticParams() {
  return getProductSlugs();
}

const refTypeLabel = {
  GARMENT: "服装",
  ACCESSORIES: "配饰",
  SHOES: "鞋履",
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "商品不存在" };
  return {
    title: product.name,
    description: product.description.slice(0, 120),
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const sold = product.status === "SOLD";

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/products"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回商品
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <ProductGallery images={product.images} alt={product.name} />

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{product.category.name}</Badge>
              <Badge variant={sold ? "secondary" : "default"}>
                {sold ? "已售出" : "仅此一件"}
              </Badge>
              {product.refType !== "GARMENT" ? (
                <Badge variant="outline">
                  {refTypeLabel[product.refType]}
                </Badge>
              ) : null}
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">
              {product.name}
            </h1>
            <p className="text-2xl">{formatPrice(product.priceCents)}</p>
            <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
              {product.description}
            </p>
          </div>

          {product.tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">颜色</dt>
              <dd className="mt-1">{product.color}</dd>
            </div>
            <div className="rounded-lg border bg-muted/30 px-3 py-2">
              <dt className="text-xs text-muted-foreground">尺码标签</dt>
              <dd className="mt-1">{product.sizeLabel ?? "—"}</dd>
            </div>
            {product.material ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">材质</dt>
                <dd className="mt-1">{product.material}</dd>
              </div>
            ) : null}
            {product.careInstructions ? (
              <div className="rounded-lg border bg-muted/30 px-3 py-2">
                <dt className="text-xs text-muted-foreground">护理</dt>
                <dd className="mt-1">{product.careInstructions}</dd>
              </div>
            ) : null}
          </dl>

          <div>
            <h2 className="text-sm font-medium">成衣尺寸</h2>
            <div className="mt-3">
              <ProductSizeTable product={product} />
            </div>
          </div>

          <div className="space-y-2">
            <AddToCartButton product={product} />
            {sold ? (
              <p className="text-sm text-muted-foreground">
                这件已经被买走了，{" "}
                <Link href="/products" className="underline">
                  看看其他商品
                </Link>
                。
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                演示环境：加入购物车不会产生真实交易；AI 试穿将在 M4 开放。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
