import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AddToCartButton } from "@/components/product/add-to-cart-button";
import { ProductDetailTabs } from "@/components/product/product-detail-tabs";
import { ProductGallery } from "@/components/product/product-gallery";
import { ShippingInfo } from "@/components/product/shipping-info";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/format";
import {
  getProductBySlug,
  getProductSlugs,
  getRecommendedProducts,
  toProductCardData,
} from "@/lib/products";

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
  const [product, recommended] = await Promise.all([
    getProduct(slug),
    getRecommendedProducts(8),
  ]);
  if (!product) notFound();

  const sold = product.status === "SOLD";
  const recommendations = recommended
    .filter((item) => item.id !== product.id)
    .slice(0, 4)
    .map(toProductCardData);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/products"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回商品
      </Link>

      <div className="mt-6 grid gap-10 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <ProductGallery images={product.images} alt={product.name} />
        </div>

        <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:h-[calc(100vh-7rem)] lg:justify-between lg:self-start lg:overflow-y-auto lg:pr-1">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{product.category.name}</Badge>
              {sold ? <Badge variant="secondary">已售出</Badge> : null}
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

          <ShippingInfo />

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
        </aside>

        <div className="min-w-0 lg:col-start-1 lg:row-start-2">
          <ProductDetailTabs
            product={product}
            recommendations={recommendations}
          />
        </div>
      </div>
    </div>
  );
}
