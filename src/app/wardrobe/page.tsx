import Link from "next/link";
import { Suspense } from "react";
import { SlidersHorizontal } from "lucide-react";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls } from "@/lib/cos";
import { countByCategory, listItems } from "@/lib/wardrobe/items";
import { listTags } from "@/lib/wardrobe/tags";
import {
  buildWardrobeHref,
  toggleTag,
  type WardrobeQueryState,
} from "@/lib/wardrobe/query";
import { parseItemQuery } from "@/lib/validations/wardrobe";
import { CategoryTabs } from "@/components/wardrobe/category-tabs";
import { TagFilter } from "@/components/wardrobe/tag-filter";
import { WardrobeExplorer } from "@/components/wardrobe/wardrobe-explorer";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export const metadata = { title: "我的衣橱 · OutfitHub" };
export const instant = false;

type RawSearchParams = Record<string, string | string[] | undefined>;

function toState(raw: RawSearchParams): WardrobeQueryState {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw)) {
    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, item));
    } else if (value !== undefined) {
      params.set(key, value);
    }
  }
  const parsed = parseItemQuery(params);
  return {
    q: parsed.q,
    category: parsed.category,
    zone: parsed.zone,
    tags: parsed.tags,
    sort: parsed.sort,
    page: parsed.page,
  };
}

async function WardrobeResults({ raw }: { raw: RawSearchParams }) {
  const session = await requireUser("/wardrobe");
  const state = toState(raw);

  const [result, counts, tags] = await Promise.all([
    listItems(session.user.id, {
      q: state.q,
      category: state.category,
      zone: state.zone ?? "WARDROBE",
      tags: state.tags,
      sort: state.sort,
      page: state.page,
    }),
    countByCategory(session.user.id, state.zone ?? "WARDROBE"),
    listTags(session.user.id, { limit: 100 }),
  ]);

  const signed = await getSignedUrls(result.items.map((item) => item.coverKey));
  const cards = result.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    brand: item.brand,
    coverUrl: signed[item.coverKey] ?? null,
    tags: item.tags,
  }));

  const empty = result.total === 0;
  const filtered = Boolean(state.q || state.category || state.tags?.length);

  return (
    <>
      <CategoryTabs current={state} counts={counts} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_1fr]">
        {/* 桌面筛选栏 */}
        <aside className="hidden space-y-6 lg:block">
          <div className="sticky top-24 space-y-6">
            <TagFilter tags={tags} current={state} />

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">排序</p>
              <div className="flex flex-col gap-1">
                {(
                  [
                    ["newest", "最近添加"],
                    ["name", "名称"],
                  ] as const
                ).map(([value, label]) => (
                  <Link
                    key={value}
                    href={buildWardrobeHref(state, { sort: value })}
                    className={cn(
                      "rounded-md px-2 py-1 text-sm transition-colors",
                      (state.sort ?? "newest") === value
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <div>
          {/* 搜索 + 移动端筛选入口 */}
          <div className="flex flex-wrap items-center gap-2 border-b pb-4">
            <form
              action="/wardrobe"
              method="get"
              className="flex min-w-0 flex-1 gap-2 sm:max-w-xs"
            >
              {state.category ? (
                <input type="hidden" name="category" value={state.category} />
              ) : null}
              {state.sort ? (
                <input type="hidden" name="sort" value={state.sort} />
              ) : null}
              {(state.tags ?? []).map((tag) => (
                <input key={tag} type="hidden" name="tag" value={tag} />
              ))}
              <Input
                name="q"
                defaultValue={state.q ?? ""}
                placeholder="搜索名称、品牌、材质、标签…"
                aria-label="搜索单品"
              />
              <Button type="submit" variant="outline">
                搜索
              </Button>
            </form>

            {/* 移动端筛选 */}
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
                    <SheetTitle>筛选单品</SheetTitle>
                    <SheetDescription className="sr-only">
                      按标签和排序筛选
                    </SheetDescription>
                  </SheetHeader>
                  <div className="mt-4 space-y-6">
                    <TagFilter tags={tags} current={state} />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        排序
                      </p>
                      <div className="flex gap-2">
                        {(
                          [
                            ["newest", "最近添加"],
                            ["name", "名称"],
                          ] as const
                        ).map(([value, label]) => (
                          <Link
                            key={value}
                            href={buildWardrobeHref(state, { sort: value })}
                            className={cn(
                              "rounded-md border px-3 py-1.5 text-sm",
                              (state.sort ?? "newest") === value && "bg-muted",
                            )}
                          >
                            {label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>

          {/* 已选筛选条件回显 */}
          {state.tags && state.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-muted-foreground">已选标签：</span>
              {state.tags.map((tag) => (
                <Link
                  key={tag}
                  href={buildWardrobeHref(state, {
                    tags: toggleTag(state.tags, tag),
                  })}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1"
                >
                  {tag}
                  <span className="text-muted-foreground">×</span>
                </Link>
              ))}
            </div>
          ) : null}

          <div className="mt-6">
            {empty ? (
              <div className="rounded-xl border border-dashed p-10 text-center">
                <p className="text-sm font-medium">
                  {filtered ? "没有符合条件的单品" : "衣橱还是空的"}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {filtered
                    ? "试试调整标签或搜索关键词。"
                    : "拍下第一件衣服，开始建立你的衣橱。"}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {filtered ? (
                    <Link
                      href="/wardrobe"
                      className={buttonVariants({ variant: "outline" })}
                    >
                      清空筛选
                    </Link>
                  ) : null}
                  <Link
                    href="/items/new"
                    className={buttonVariants({ variant: "default" })}
                  >
                    ＋ 添加单品
                  </Link>
                </div>
              </div>
            ) : (
              <WardrobeExplorer items={cards} />
            )}
          </div>

          {/* 分页 */}
          {result.totalPages > 1 ? (
            <nav className="mt-10 flex items-center justify-center gap-1">
              {Array.from({ length: result.totalPages }, (_, index) => index + 1).map(
                (page) => (
                  <Link
                    key={page}
                    href={buildWardrobeHref(state, { page, resetPage: false })}
                    className={cn(
                      "min-w-9 rounded-md px-2 py-1 text-center text-sm",
                      page === result.page
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {page}
                  </Link>
                ),
              )}
            </nav>
          ) : null}
        </div>
      </div>
    </>
  );
}

function WardrobeSkeleton() {
  return (
    <>
      <div className="h-10 w-full animate-pulse rounded bg-muted/50" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[200px_1fr]">
        <div className="hidden lg:block">
          <div className="h-64 animate-pulse rounded-xl bg-muted/40" />
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-3">
              <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default function WardrobePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted-foreground">
            WARDROBE
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            我的衣橱
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            按分类和标签翻你的衣服。
          </p>
        </div>
        <Link
          href="/items/new"
          className={buttonVariants({ variant: "default" })}
        >
          ＋ 添加单品
        </Link>
      </div>

      <Suspense fallback={<WardrobeSkeleton />}>
        <WardrobeContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WardrobeContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  return <WardrobeResults raw={raw} />;
}
