"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  whiteKey: string;
  originalKey: string | null;
  url: string | null;
  originalUrl: string | null;
};

/** 单品详情图集：点击缩略图切换大图 */
export function ItemGallery({ images, name }: { images: Item[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active];

  if (!current) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-xl border bg-muted text-sm text-muted-foreground">
        暂无图片
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[4/5] overflow-hidden rounded-xl border bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:20px_20px]">
        {current.url ? (
          // 签名 URL 域名随 COS 桶变化，用原生 img 避免配置 remotePatterns
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={name}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            图片加载失败
          </div>
        )}
      </div>

      {images.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "h-20 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted",
                index === active && "ring-2 ring-primary",
              )}
              aria-label={`第 ${index + 1} 张图`}
            >
              {image.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={image.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
