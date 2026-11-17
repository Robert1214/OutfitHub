import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls } from "@/lib/cos";
import { listItems } from "@/lib/wardrobe/items";
import { listTags } from "@/lib/wardrobe/tags";
import {
  getTriedItemIds,
  listRecentTryons,
} from "@/lib/wardrobe/new-zone";
import { parseItemQuery } from "@/lib/validations/wardrobe";
import { NewItemGrid } from "@/components/wardrobe/new-item-grid";
import { RecentTryons } from "@/components/wardrobe/recent-tryons";
import { TagFilter } from "@/components/wardrobe/tag-filter";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata = { title: "新单据 · OutfitHub" };
export const instant = false;

type RawSearchParams = Record<string, string | string[] | undefined>;

/** New 区筛选 URL（与衣橱同构，但固定 zone=NEW） */
function buildNewHref(
  current: { q?: string; tags?: string[]; page?: number },
  overrides: Partial<{ q?: string; tags?: string[]; page?: number }> = {},
): string {
  const next = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  for (const tag of next.tags ?? []) params.append("tag", tag);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/new?${qs}` : "/new";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function NewZoneResults({ raw }: { raw: RawSearchParams }) {
  const session = await requireUser("/new");

  const params = new URLSearchParams();
  if (typeof raw.q === "string") params.set("q", raw.q);
  for (const tag of Array.isArray(raw.tag) ? raw.tag : raw.tag ? [raw.tag] : []) {
    params.append("tag", tag);
  }
  if (typeof raw.page === "string") params.set("page", raw.page);

  const query = parseItemQuery(params);
  const state = { q: query.q, tags: query.tags, page: query.page };

  const [result, tags, tryons] = await Promise.all([
    listItems(session.user.id, {
      q: query.q,
      tags: query.tags,
      page: query.page,
      zone: "NEW",
    }),
    listTags(session.user.id, { limit: 60 }),
    listRecentTryons(session.user.id, 6),
  ]);

  const [signed, tryonSigned, triedIds] = await Promise.all([
    getSignedUrls(result.items.map((item) => item.coverKey)),
    getSignedUrls(
      tryons
        .map((tryon) => tryon.resultKey)
        .filter((key): key is string => Boolean(key)),
    ),
    getTriedItemIds(
      session.user.id,
      result.items.map((item) => item.id),
    ),
  ]);

  const cards = result.items.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    brand: item.brand,
    coverUrl: signed[item.coverKey] ?? null,
    tags: item.tags,
    tried: triedIds.has(item.id),
  }));

  const filtered = Boolean(state.q || state.tags?.length);
  const tryonCards = tryons.map((tryon) => ({
    id: tryon.id,
    status: tryon.status,
    resultUrl: tryon.resultKey ? (tryonSigned[tryon.resultKey] ?? null) : null,
    createdAtLabel: formatDate(tryon.createdAt),
    itemCount: tryon.itemCount,
    itemNames: tryon.itemNames,
  }));

  return (
    <>
      {/* 最近试穿 */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">最近试穿</h2>
          {tryons.length > 0 ? (
            <Link
              href="/account/tryons"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              查看全部
            </Link>
          ) : null}
        </div>
        <RecentTryons tryons={tryonCards} />
      </section>

      {/* 待定单品 */}
      <section className="mt-10 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">
            待定单品
            <span className="ml-1.5 text-xs font-normal text-muted-foreground">
              {result.total} 件
            </span>
          </h2>
          <Link
            href="/items/new?zone=NEW"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            ＋ 新单据
          </Link>
        </div>

        {/* 页内搜索 */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-4">
          <form
            action="/new"
            method="get"
            className="flex min-w-0 flex-1 gap-2 sm:max-w-sm"
          >
            {(state.tags ?? []).map((tag) => (
              <input key={tag} type="hidden" name="tag" value={tag} />
            ))}
            <Input
              name="q"
              defaultValue={state.q ?? ""}
              placeholder="搜索名称、品牌、材质、标签…"
              aria-label="搜索新单据"
            />
            <Button type="submit" variant="outline">
              搜索
            </Button>
          </form>
        </div>

        {/* 标签筛选（留在本页，不跳去衣橱） */}
        {tags.length > 0 ? (
          <TagFilter
            tags={tags}
            current={{ q: state.q, tags: state.tags, sort: undefined }}
            basePath="/new"
          />
        ) : null}

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="text-sm font-medium">
              {filtered ? "没有符合条件的单品" : "New 区是空的"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {filtered
                ? "试试调整标签或搜索关键词。"
                : "网购前把候选单品放进来，试穿后再决定去留。"}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {filtered ? (
                <Link
                  href="/new"
                  className={buttonVariants({ variant: "outline" })}
                >
                  清空筛选
                </Link>
              ) : null}
              <Link
                href="/items/new?zone=NEW"
                className={buttonVariants({ variant: "default" })}
              >
                ＋ 添加新单据
              </Link>
            </div>
          </div>
        ) : (
          <NewItemGrid items={cards} />
        )}

        {result.totalPages > 1 ? (
          <nav className="mt-8 flex items-center justify-center gap-1">
            {Array.from(
              { length: result.totalPages },
              (_, index) => index + 1,
            ).map((page) => (
              <Link
                key={page}
                href={buildNewHref(state, { page })}
                className={cn(
                  "min-w-9 rounded-md px-2 py-1 text-center text-sm",
                  page === result.page
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {page}
              </Link>
            ))}
          </nav>
        ) : null}
      </section>
    </>
  );
}

function NewZoneSkeleton() {
  return (
    <>
      <div className="h-40 animate-pulse rounded-xl bg-muted/50" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-xl bg-muted/40" />
        ))}
      </div>
    </>
  );
}

export default function NewZonePage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <p className="text-xs tracking-[0.28em] text-muted-foreground">NEW</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          新单据
        </h1>
        <p className="text-sm text-muted-foreground">
          还不确定留不留的单品先放这里，试穿后再决定去留。
        </p>
      </div>

      <Suspense fallback={<NewZoneSkeleton />}>
        <NewZoneContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function NewZoneContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  return <NewZoneResults raw={raw} />;
}
