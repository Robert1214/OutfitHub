import Link from "next/link";
import { Suspense } from "react";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { ExpandableProductGrid } from "@/components/product/expandable-product-grid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCategoriesWithCounts,
  getFeaturedProducts,
  getRecommendedProducts,
  toProductCardData,
} from "@/lib/products";

async function HomeHeroCarousel() {
  const products = await getFeaturedProducts(5);
  return <HeroCarousel products={products} />;
}

function HeroCarouselSkeleton() {
  return (
    <div
      className="aspect-[16/10] w-full animate-pulse rounded-2xl border bg-muted sm:aspect-[16/7] lg:aspect-[21/9]"
      aria-hidden
    />
  );
}

async function HomeSections() {
  const [categories, products] = await Promise.all([
    getCategoriesWithCounts(),
    getRecommendedProducts(60),
  ]);
  const cards = products.map(toProductCardData);

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
        <div className="mt-6">
          <ExpandableProductGrid products={cards} />
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
      <section className="pb-8 pt-10 sm:pt-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-bodoni text-3xl font-medium leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
              YOU ARE WHAT YOU WEAR!
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              本店商品均为孤品
            </p>
          </div>

          <form
            action="/products"
            method="get"
            className="flex w-full gap-2 sm:w-80"
          >
            <Input
              name="q"
              required
              placeholder="搜索商品…"
              aria-label="搜索商品"
              className="h-10"
            />
            <Button type="submit" className="h-10 shrink-0 px-4">
              搜索
            </Button>
          </form>
        </div>

        <div className="mt-8">
          <Suspense fallback={<HeroCarouselSkeleton />}>
            <HomeHeroCarousel />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<HomeSectionsSkeleton />}>
        <HomeSections />
      </Suspense>
    </div>
  );
}
