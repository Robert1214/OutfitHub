import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls } from "@/lib/cos";
import { listLooks } from "@/lib/looks";
import { listTags } from "@/lib/wardrobe/tags";
import { buildLooksHref, toggleLookTag } from "@/lib/looks-query";
import { LookGrid } from "@/components/looks/look-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const metadata = { title: "我的搭配 · OutfitHub" };
export const instant = false;

type RawSearchParams = Record<string, string | string[] | undefined>;

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function LooksResults({ raw }: { raw: RawSearchParams }) {
  const session = await requireUser("/looks");

  const q = typeof raw.q === "string" ? raw.q.trim() || undefined : undefined;
  const tagList = Array.isArray(raw.tag)
    ? raw.tag
    : raw.tag
      ? [raw.tag]
      : [];
  const tags = tagList.map((t) => t.trim()).filter(Boolean);
  const rawPage = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [result, allTags] = await Promise.all([
    listLooks(session.user.id, { q, tags, page }),
    listTags(session.user.id, { limit: 60 }),
  ]);

  const keys = result.looks.flatMap((look) => [
    ...[look.photoKey, look.collageKey].filter(
      (key): key is string => Boolean(key),
    ),
    ...look.fallbackCoverKeys,
  ]);
  const signed = await getSignedUrls(keys);

  const cards = result.looks.map((look) => ({
    id: look.id,
    name: look.name,
    occasion: look.occasion,
    wornAtLabel: formatDate(look.wornAt ?? look.createdAt),
    photoUrl: look.photoKey ? (signed[look.photoKey] ?? null) : null,
    collageUrl: look.collageKey ? (signed[look.collageKey] ?? null) : null,
    fallbackUrls: look.fallbackCoverKeys.map((key) => signed[key] ?? null),
    itemCount: look.itemCount,
    tags: look.tags,
  }));

  const state = { q, tags, page };
  const filtered = Boolean(q || tags.length > 0);

  return (
    <>
      {/* 搜索 + 场景标签筛选 */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <form
          action="/looks"
          method="get"
          className="flex min-w-0 flex-1 gap-2 sm:max-w-sm"
        >
          {tags.map((tag) => (
            <input key={tag} type="hidden" name="tag" value={tag} />
          ))}
          <Input
            name="q"
            defaultValue={q ?? ""}
            placeholder="搜索搭配名称、场景、备注…"
            aria-label="搜索搭配"
          />
          <Button type="submit" variant="outline">
            搜索
          </Button>
        </form>
      </div>

      {allTags.length > 0 ? (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              场景标签
            </p>
            {tags.length > 0 ? (
              <Link
                href={buildLooksHref(state, { tags: [] })}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                清空
              </Link>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {allTags.slice(0, 20).map((tag) => {
              const active = tags.includes(tag.name);
              return (
                <Link
                  key={tag.id}
                  href={buildLooksHref(state, {
                    tags: toggleLookTag(tags, tag.name),
                  })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-muted",
                  )}
                >
                  {tag.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {cards.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">
            {filtered ? "没有符合条件的搭配" : "还没有搭配"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {filtered
              ? "试试调整标签或搜索关键词。"
              : "去衣橱勾选 2~8 件单品，生成第一套搭配。"}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {filtered ? (
              <Link
                href="/looks"
                className={buttonVariants({ variant: "outline" })}
              >
                清空筛选
              </Link>
            ) : null}
            <Link
              href="/wardrobe"
              className={buttonVariants({ variant: "default" })}
            >
              去衣橱挑单品
            </Link>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            共 {result.total} 套
          </p>
          <div className="mt-4">
            <LookGrid looks={cards} />
          </div>
        </>
      )}

      {result.totalPages > 1 ? (
        <nav className="mt-10 flex items-center justify-center gap-1">
          {Array.from(
            { length: result.totalPages },
            (_, index) => index + 1,
          ).map((p) => (
            <Link
              key={p}
              href={buildLooksHref(state, { page: p })}
              className={cn(
                "min-w-9 rounded-md px-2 py-1 text-center text-sm",
                p === result.page
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {p}
            </Link>
          ))}
        </nav>
      ) : null}
    </>
  );
}

function LooksSkeleton() {
  return (
    <>
      <div className="h-10 w-full max-w-sm animate-pulse rounded-md bg-muted" />
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="space-y-3">
            <div className="aspect-[4/5] animate-pulse rounded-xl bg-muted" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </>
  );
}

export default function LooksPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted-foreground">
            LOOKS
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            我的搭配
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            鼠标悬停在卡片上可以看到白底拼合图。
          </p>
        </div>
        <Link
          href="/wardrobe"
          className={buttonVariants({ variant: "default" })}
        >
          ＋ 新建搭配
        </Link>
      </div>

      <Suspense fallback={<LooksSkeleton />}>
        <LooksContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function LooksContent({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const raw = await searchParams;
  return <LooksResults raw={raw} />;
}
