"use client";

import { useState } from "react";
import { CosImage } from "@/components/wardrobe/cos-image";
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
      {/* 展示白底图，容器用纯白 */}
      <div className="aspect-[4/5] overflow-hidden rounded-xl border bg-white">
        <CosImage
          src={current.url}
          alt={name}
          fallbackText="图片已失效，建议重新上传"
          className="h-full w-full object-contain"
        />
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
              <CosImage
                src={image.url}
                alt=""
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
