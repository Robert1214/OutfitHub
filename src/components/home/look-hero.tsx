"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { HoverSwapImage } from "@/components/looks/hover-swap-image";
import { FallbackGrid } from "@/components/looks/fallback-grid";
import { cn } from "@/lib/utils";

export type HeroLook = {
  id: string;
  name: string;
  occasion: string | null;
  wornAtLabel: string | null;
  photoUrl: string | null;
  collageUrl: string | null;
  fallbackUrls: (string | null)[];
  itemCount: number;
};

/**
 * 首页 Hero 轮播：多套搭配横向滑动，6 秒自动切换，悬停暂停。
 *
 * 版式沿用旧商品首页：宽幅 + 背景模糊铺满 + 前景 contain 居中，
 * 这样竖图（实穿照）在宽幅里也不会留大片空白。
 * 前景用 HoverSwapImage，悬停切换白底拼合图。
 */
export function LookHeroCarousel({ looks }: { looks: HeroLook[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (looks.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % looks.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [looks.length, paused]);

  // 搭配数量变化时防止越界：直接用取模，避免在 effect 里 setState
  const safeIndex = looks.length > 0 ? index % looks.length : 0;

  if (looks.length === 0) {
    return (
      <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/30 text-center sm:aspect-[16/7] lg:aspect-[21/9]">
        <p className="text-sm font-medium">还没有搭配</p>
        <p className="text-xs text-muted-foreground">
          去衣橱勾选 2~8 件单品，生成第一套
        </p>
        <Link
          href="/wardrobe"
          className="mt-2 rounded-lg bg-primary px-3 py-1.5 text-xs text-primary-foreground"
        >
          去衣橱挑单品
        </Link>
      </div>
    );
  }

  function go(direction: -1 | 1) {
    setIndex((current) => (current + direction + looks.length) % looks.length);
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-[#f1ede6]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${safeIndex * 100}%)` }}
      >
        {looks.map((look, slideIndex) => {
          const front = look.photoUrl ?? look.collageUrl;
          return (
            <Link
              key={look.id}
              href={`/looks/${look.id}`}
              className="relative block aspect-[16/10] w-full shrink-0 sm:aspect-[16/7] lg:aspect-[21/9]"
              aria-label={`查看搭配 ${look.name}`}
            >
              {/* 背景：模糊放大的同一张图，铺满宽幅，避免左右留白 */}
              {front ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={front}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl"
                />
              ) : null}

              {/* 前景：完整图 + 悬停切换白底拼图 */}
              <div className="absolute inset-0 p-3 sm:p-6">
                {look.photoUrl || look.collageUrl ? (
                  <HoverSwapImage
                    front={look.photoUrl}
                    back={look.collageUrl}
                    alt={look.name}
                    className="h-full w-full"
                    fit="contain"
                    priority={slideIndex === 0}
                    fallbackText="暂无图片"
                  />
                ) : (
                  <FallbackGrid
                    urls={look.fallbackUrls}
                    alt={look.name}
                    className="h-full w-full rounded-lg"
                  />
                )}
              </div>

              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

              {/* 移动端文字更小、留白更少，避免和图片重叠 */}
              <div className="absolute bottom-3 left-3 max-w-[75%] text-white sm:bottom-8 sm:left-8">
                <p className="text-[9px] uppercase tracking-[0.2em] text-white/75 sm:text-[11px]">
                  LATEST LOOK
                </p>
                <h2 className="mt-0.5 text-base font-medium sm:mt-1 sm:text-3xl">
                  {look.name}
                </h2>
                <p className="mt-0.5 text-[11px] text-white/90 sm:mt-1 sm:text-base">
                  {[look.occasion, look.wornAtLabel, `${look.itemCount} 件`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {looks.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="上一套搭配"
            className="absolute left-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background sm:left-5 sm:size-10"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="下一套搭配"
            className="absolute right-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background sm:right-5 sm:size-10"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-4 right-4 z-20 flex gap-1.5 sm:bottom-6 sm:right-6">
            {looks.map((look, dotIndex) => (
              <button
                key={look.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`查看第 ${dotIndex + 1} 套搭配`}
                aria-current={dotIndex === safeIndex}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  dotIndex === safeIndex
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/75",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
