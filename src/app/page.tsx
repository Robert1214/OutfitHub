import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product/product-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCategoriesWithCounts,
  getRecommendedProducts,
} from "@/lib/products";

async function HomeSections() {
  const [categories, products] = await Promise.all([
    getCategoriesWithCounts(),
    getRecommendedProducts(8),
  ]);

  return (
    <>
      <section className="pb-16">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.28em] text-muted-foreground">
              CATEGORIES
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              按分类逛
            </h2>
          </div>
          <Link
            href="/products"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            查看全部商品
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/products?category=${category.slug}`}
              className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50"
            >
              <p className="text-sm font-medium">{category.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {category._count.products} 件在售
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="pb-20">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.28em] text-muted-foreground">
              NEW ARRIVALS
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              本季推荐
            </h2>
          </div>
          <Link
            href="/products"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            查看全部
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </>
  );
}

function HomeSectionsSkeleton() {
  return (
    <>
      <section className="pb-16" aria-hidden>
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl border bg-muted/40"
            />
          ))}
        </div>
      </section>
      <section className="pb-20" aria-hidden>
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-4 h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 sm:py-24">
        <p className="text-xs tracking-[0.32em] text-muted-foreground">
          OUTFIT EXPERT
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl">
          把喜欢的衣服，
          <br />
          先穿在身上看看。
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
          孤品服装店：每件只有一件。先逛商品，再用 AI
          试穿看看上身效果，最后演示下单。
        </p>

        <form
          action="/products"
          method="get"
          className="mt-8 flex w-full max-w-xl flex-col gap-2 sm:flex-row"
        >
          <Input
            name="q"
            required
            placeholder="搜索针织、连衣裙、通勤…"
            aria-label="搜索商品"
            className="h-11 flex-1"
          />
          <Button type="submit" size="lg" className="h-11 px-6">
            搜索
          </Button>
        </form>
      </section>

      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections />
      </Suspense>
    </div>
  );
}
