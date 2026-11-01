"use client";

import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type FilterOption = { value: string; label: string };

export type CurrentProductFilters = {
  q?: string;
  category?: string;
  color?: string;
  fitType?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  includeSold?: boolean;
};

const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none transition focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50";

function FilterForm({
  idPrefix,
  categories,
  colors,
  current,
}: {
  idPrefix: string;
  categories: FilterOption[];
  colors: string[];
  current: CurrentProductFilters;
}) {
  return (
    <form action="/products" method="get" className="mt-4 space-y-5">
      {current.q ? <input type="hidden" name="q" value={current.q} /> : null}
      {current.sort ? (
        <input type="hidden" name="sort" value={current.sort} />
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-category`}>分类</Label>
        <select
          id={`${idPrefix}-category`}
          name="category"
          defaultValue={current.category ?? ""}
          className={selectClassName}
        >
          <option value="">全部分类</option>
          {categories.map((category) => (
            <option key={category.value} value={category.value}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-color`}>颜色</Label>
        <select
          id={`${idPrefix}-color`}
          name="color"
          defaultValue={current.color ?? ""}
          className={selectClassName}
        >
          <option value="">全部颜色</option>
          {colors.map((color) => (
            <option key={color} value={color}>
              {color}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-fit-type`}>版型</Label>
        <select
          id={`${idPrefix}-fit-type`}
          name="fitType"
          defaultValue={current.fitType ?? ""}
          className={selectClassName}
        >
          <option value="">全部版型</option>
          <option value="SLIM">紧身</option>
          <option value="REGULAR">合身</option>
          <option value="LOOSE">宽松</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label>价格区间（元）</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            name="minPrice"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="最低"
            defaultValue={current.minPrice ?? ""}
            aria-label="最低价格"
          />
          <span className="text-muted-foreground">—</span>
          <Input
            type="number"
            name="maxPrice"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="最高"
            defaultValue={current.maxPrice ?? ""}
            aria-label="最高价格"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="includeSold"
          value="1"
          defaultChecked={current.includeSold}
          className="size-4 rounded border-input accent-primary"
        />
        显示已售商品
      </label>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          应用筛选
        </Button>
        <Link
          href="/products"
          className={buttonVariants({ variant: "ghost" })}
        >
          清空
        </Link>
      </div>
    </form>
  );
}

export function ProductFilters({
  categories,
  colors,
  current,
}: {
  categories: FilterOption[];
  colors: string[];
  current: CurrentProductFilters;
}) {
  return (
    <>
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-xl border bg-card p-5">
          <p className="text-sm font-medium">筛选</p>
          <FilterForm
            idPrefix="desktop"
            categories={categories}
            colors={colors}
            current={current}
          />
        </div>
      </aside>

      <div className="lg:hidden">
        <Sheet>
          <SheetTrigger
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <SlidersHorizontal className="size-4" />
            筛选
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-[85vw] overflow-y-auto p-5 sm:max-w-sm"
          >
            <SheetHeader>
              <SheetTitle>筛选商品</SheetTitle>
              <SheetDescription className="sr-only">
                按分类、颜色、版型和价格筛选商品
              </SheetDescription>
            </SheetHeader>
            <FilterForm
              idPrefix="mobile"
              categories={categories}
              colors={colors}
              current={current}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
