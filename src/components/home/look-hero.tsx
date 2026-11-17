import Link from "next/link";
import { HoverSwapImage } from "@/components/looks/hover-swap-image";
import { FallbackGrid } from "@/components/looks/fallback-grid";
import { buttonVariants } from "@/components/ui/button";

export type HeroLook = {
  id: string;
  name: string;
  occasion: string | null;
  wornAtLabel: string | null;
  note: string | null;
  photoUrl: string | null;
  collageUrl: string | null;
  fallbackUrls: (string | null)[];
  itemCount: number;
  tags: { id: string; name: string }[];
};

/**
 * 首页 Hero：最新一套搭配。
 * 左图（竖图 4:5，悬停切换白底拼合图）+ 右侧信息，避免宽幅里的左右留白。
 */
export function LookHero({ look }: { look: HeroLook | null }) {
  if (!look) {
    return (
      <div className="grid gap-6 sm:grid-cols-[minmax(0,320px)_1fr]">
        <div className="flex aspect-[4/5] items-center justify-center rounded-xl border border-dashed bg-muted/30 text-center">
          <p className="px-6 text-xs text-muted-foreground">
            还没有搭配
            <br />
            去衣橱勾选 2~8 件生成第一套
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <p className="text-xs tracking-[0.28em] text-muted-foreground">
            LATEST LOOK
          </p>
          <p className="text-xl font-semibold">从第一套搭配开始</p>
          <p className="text-sm text-muted-foreground">
            拍下衣服 → AI 去背景 → 勾选几件 → 画布排版
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link href="/items/new" className={buttonVariants()}>
              ＋ 添加单品
            </Link>
            <Link
              href="/wardrobe"
              className={buttonVariants({ variant: "outline" })}
            >
              去衣橱
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-center">
      <Link
        href={`/looks/${look.id}`}
        className="group block overflow-hidden rounded-xl border"
      >
        <div className="aspect-[4/5]">
          {look.photoUrl || look.collageUrl ? (
            <HoverSwapImage
              front={look.photoUrl}
              back={look.collageUrl}
              alt={look.name}
              className="h-full w-full"
              fit="cover"
              priority
              fallbackText="暂无图片"
            />
          ) : (
            <FallbackGrid
              urls={look.fallbackUrls}
              alt={look.name}
              className="h-full w-full"
            />
          )}
        </div>
      </Link>

      <div className="space-y-3">
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          LATEST LOOK
        </p>
        <Link href={`/looks/${look.id}`} className="block">
          <h2 className="text-2xl font-semibold tracking-tight hover:underline sm:text-3xl">
            {look.name}
          </h2>
        </Link>
        <p className="text-sm text-muted-foreground">
          {[look.occasion, look.wornAtLabel, `${look.itemCount} 件`]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {look.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {look.tags.map((tag) => (
              <Link
                key={tag.id}
                href={`/looks?tag=${encodeURIComponent(tag.name)}`}
                className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        ) : null}

        {look.note ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {look.note}
          </p>
        ) : null}

        <p className="text-xs text-muted-foreground">
          悬停图片可切换白底拼合图
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href={`/looks/${look.id}`}
            className={buttonVariants({ size: "sm" })}
          >
            查看搭配
          </Link>
          <Link
            href={`/looks/${look.id}/edit`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            编辑排版
          </Link>
        </div>
      </div>
    </div>
  );
}
