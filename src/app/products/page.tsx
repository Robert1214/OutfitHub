import Link from "next/link";
import { Suspense } from "react";
import { ProductCard } from "@/components/product/product-card";
import {
  ProductFilters,
  type CurrentProductFilters,
} from "@/components/product/product-filters";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getCategoriesWithCounts,
  getProductColors,
  getProducts,
} from "@/lib/products";
import { cn } from "@/lib/utils";
import {
  buildProductsHref,
  firstParam,
  parseProductListParams,
  type RawSearchParams,
} from "@/lib/validations/product-query";

export const metadata = { title: "全部商品" };

const sortOptions = [
  { value: "newest", label: "最新" },
  { value: "price_asc", label: "价格从低到高" },
  { value: "price_desc", label: "价格从高到低" },
] as const;

const preservedFilterKeys = [
  "category",
  "color",
  "fitType",
  "minPrice",
  "maxPrice",
  "sort",
  "includeSold",
] as const;

function Pagination({
  raw,
  page,
  pageCount,
}: {
  raw: RawSearchParams;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      className="mt-10 flex items-center justify-center gap-3 text-sm"
      aria-label="分页"
    >
      <Link
        href={buildProductsHref(raw, { page: page - 1 })}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page <= 1 && "pointer-events-none opacity-50",
        )}
        aria-disabled={page <= 1}
      >
        上一页
      </Link>
      <span className="text-muted-foreground">
        第 {page} / {pageCount} 页
      </span>
      <Link
        href={buildProductsHref(raw, { page: page + 1 })}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          page >= pageCount && "pointer-events-none opacity-50",
        )}
        aria-disabled={page >= pageCount}
      >
        下一页
      </Link>
    </nav>
  );
}

async function ProductResults({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  const params = parseProductListParams(raw);

  const [result, categories, colors] = await Promise.all([
    getProducts(params),
    getCategoriesWithCounts(),
    getProductColors(),
  ]);

  const current: CurrentProductFilters = {
    q: params.q,
    category: params.category,
    color: params.color,
    fitType: params.fitType,
    minPrice: firstParam(raw.minPrice),
    maxPrice: firstParam(raw.maxPrice),
    sort: params.sort,
    includeSold: params.includeSold,
  };

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
      <div className="space-y-4">
        <ProductFilters
          categories={categories.map((category) => ({
            value: category.slug,
            label: category.name,
          }))}
          colors={colors}
          current={current}
        />
      </div>

      <div>
        <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
          <form
            action="/products"
            method="get"
            className="flex w-full max-w-sm gap-2"
          >
            {preservedFilterKeys.map((key) => {
              const value = firstParam(raw[key]);
              return value ? (
                <input key={key} type="hidden" name={key} value={value} />
              ) : null;
            })}
            <Input
              name="q"
              required
              defaultValue={params.q ?? ""}
              placeholder="搜索商品…"
              aria-label="搜索商品"
            />
            <Button type="submit" variant="outline">
              搜索
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">排序</span>
            {sortOptions.map((option) => (
              <Link
                key={option.value}
                href={buildProductsHref(raw, {
                  sort: option.value,
                  page: 1,
                })}
                className={cn(
                  "rounded-md px-2 py-1 transition-colors",
                  params.sort === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            共 {result.total} 件
            {params.includeSold ? "（含已售）" : ""}
          </p>
          {result.total > 0 ? (
            <p>
              第 {result.page} / {result.pageCount} 页
            </p>
          ) : null}
        </div>

        {result.items.length === 0 ? (
          <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm font-medium">没有找到相关商品</p>
            <p className="mt-2 text-sm text-muted-foreground">
              试试调整筛选条件或搜索关键词。
            </p>
            <Link
              href="/products"
              className={buttonVariants({
                variant: "outline",
                className: "mt-4",
              })}
            >
              清空筛选
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
            {result.items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        <Pagination
          raw={raw}
          page={result.page}
          pageCount={result.pageCount}
        />
      </div>
    </div>
  );
}

function ProductsPageSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
      <div className="hidden space-y-4 lg:block">
        <div className="h-96 animate-pulse rounded-xl border bg-muted/40" />
      </div>
      <div>
        <div className="h-10 w-full max-w-sm animate-pulse rounded-md bg-muted" />
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">SHOP</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          全部商品
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          每件只有一件，售完即止。
        </p>
      </div>

      <Suspense fallback={<ProductsPageSkeleton />}>
        <ProductResults searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
