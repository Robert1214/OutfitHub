import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls } from "@/lib/cos";
import { listLooks } from "@/lib/looks";
import { listItems } from "@/lib/wardrobe/items";
import { listTags } from "@/lib/wardrobe/tags";
import { CATEGORY_LABELS } from "@/lib/validations/wardrobe";
import { LookHeroCarousel, type HeroLook } from "@/components/home/look-hero";
import { LookGrid, type LookCardData } from "@/components/looks/look-grid";
import { CosImage } from "@/components/wardrobe/cos-image";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "OutfitHub · 个人穿搭衣橱" };
export const instant = false;

function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function loadHomeData(userId: string) {
  const [recentLooks, newItems, tags] = await Promise.all([
    listLooks(userId, { page: 1 }),
    listItems(userId, { zone: "NEW", page: 1 }),
    listTags(userId, { limit: 12 }),
  ]);

  // 最近 4 件 New 单品
  const recentNew = newItems.items.slice(0, 4);

  const keys = [
    ...recentLooks.looks.flatMap((look) => [
      ...[look.photoKey, look.collageKey].filter(
        (key): key is string => Boolean(key),
      ),
      ...look.fallbackCoverKeys,
    ]),
    ...recentNew.map((item) => item.coverKey),
  ];
  const signed = await getSignedUrls(keys);

  // Hero 轮播：最近 5 套搭配（最新的一套排第一）
  const heroLooks: HeroLook[] = recentLooks.looks.slice(0, 5).map((look) => ({
    id: look.id,
    name: look.name,
    occasion: look.occasion,
    wornAtLabel: formatDate(look.wornAt ?? look.createdAt),
    photoUrl: look.photoKey ? (signed[look.photoKey] ?? null) : null,
    collageUrl: look.collageKey ? (signed[look.collageKey] ?? null) : null,
    fallbackUrls: look.fallbackCoverKeys.map((key) => signed[key] ?? null),
    itemCount: look.itemCount,
  }));

  // 搭配流：时间倒序，首页展示 12 个
  const lookCards: LookCardData[] = recentLooks.looks.slice(0, 12).map((look) => ({
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

  return { heroLooks, lookCards, recentNew, signed, tags };
}

function HomeSkeleton() {
  return (
    <>
      <div className="aspect-[16/10] w-full animate-pulse rounded-2xl bg-muted/50 sm:aspect-[16/7] lg:aspect-[21/9]" />
      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
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

async function HomeContent() {
  const session = await requireUser("/");
  const { heroLooks, lookCards, recentNew, signed, tags } = await loadHomeData(
    session.user.id,
  );

  const empty = lookCards.length === 0 && recentNew.length === 0;

  if (empty) {
    return (
      <>
        <LookHeroCarousel looks={[]} />
        <section className="mt-12 rounded-2xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">从第一件衣服开始</p>
          <p className="mt-2 text-sm text-muted-foreground">
            拍下你的衣服，AI 帮你去掉背景。攒够 2 件就能生成搭配。
          </p>
          <Link
            href="/items/new"
            className={buttonVariants({ className: "mt-4" })}
          >
            ＋ 添加第一件单品
          </Link>
        </section>
      </>
    );
  }

  return (
    <>
      <LookHeroCarousel looks={heroLooks} />

      {/* 最近 New 单品横滑 */}
      {recentNew.length > 0 ? (
        <section className="mt-12">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.28em] text-muted-foreground">
                NEW
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                待定单品
              </h2>
            </div>
            <Link
              href="/new"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              查看全部
            </Link>
          </div>

          <div className="-mx-4 mt-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            <ul className="flex gap-3">
              {recentNew.map((item) => (
                <li key={item.id} className="shrink-0">
                  <Link href={`/items/${item.id}`} className="block w-24 sm:w-28">
                    <div className="aspect-[4/5] overflow-hidden rounded-lg border bg-white">
                      <CosImage
                        src={signed[item.coverKey] ?? null}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-xs">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {CATEGORY_LABELS[item.category]}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {/* 搭配流 */}
      <section className="mt-12 pb-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs tracking-[0.28em] text-muted-foreground">
              LOOKS
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              搭配流
            </h2>
          </div>
          <Link
            href="/looks"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            查看全部
          </Link>
        </div>

        {lookCards.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              还没有搭配，去衣橱勾选 2~8 件试试
            </p>
          </div>
        ) : (
          <div className="mt-6">
            <LookGrid looks={lookCards} />
          </div>
        )}
      </section>

      {/* 场景标签快捷入口 */}
      {tags.length > 0 ? (
        <section className="pb-10">
          <p className="text-xs tracking-[0.28em] text-muted-foreground">
            TAGS
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            按标签逛
          </h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/wardrobe?tag=${encodeURIComponent(tag.name)}`}
                className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="pb-8 pt-10 sm:pt-14">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="font-bodoni text-3xl font-medium leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
              YOU ARE WHAT YOU WEAR!
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              你的私人穿搭衣橱 · OutfitHub
            </p>
          </div>

          <div className="flex w-full gap-2 sm:w-auto">
            <Link
              href="/wardrobe"
              className={buttonVariants({ variant: "outline", className: "h-10" })}
            >
              衣橱
            </Link>
            <Link
              href="/looks"
              className={buttonVariants({ variant: "outline", className: "h-10" })}
            >
              搭配
            </Link>
            <Link
              href="/new"
              className={buttonVariants({ variant: "outline", className: "h-10" })}
            >
              新单据
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <Suspense fallback={<HomeSkeleton />}>
            <HomeContent />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
