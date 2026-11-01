"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductGallery({
  images,
  alt,
}: {
  images: { url: string }[];
  alt: string;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-2xl border bg-muted text-sm text-muted-foreground">
        暂无图片
      </div>
    );
  }

  return (
    <div>
      {/* 移动端：横向滑动 */}
      <div className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl border bg-muted [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
        {images.map((image, index) => (
          <div
            key={image.url}
            className="relative aspect-[4/5] w-full shrink-0 snap-center"
          >
            <Image
              src={image.url}
              alt={`${alt} 图 ${index + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority={index === 0}
            />
          </div>
        ))}
      </div>

      {/* 桌面端：主图 + 缩略图 */}
      <div className="hidden space-y-3 lg:block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border bg-muted">
          <Image
            src={images[activeIndex]?.url ?? images[0].url}
            alt={`${alt} 图 ${activeIndex + 1}`}
            fill
            sizes="(max-width: 1280px) 50vw, 560px"
            className="object-contain"
            priority
          />
        </div>
        {images.length > 1 ? (
          <div className="grid grid-cols-3 gap-3">
            {images.map((image, index) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative aspect-square overflow-hidden rounded-lg border bg-muted transition",
                  index === activeIndex
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "opacity-70 hover:opacity-100",
                )}
                aria-label={`查看第 ${index + 1} 张图`}
                aria-pressed={index === activeIndex}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="160px"
                  className="object-contain"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
