"use client";

import { CosImage } from "@/components/wardrobe/cos-image";
import { cn } from "@/lib/utils";

type Props = {
  urls: (string | null)[];
  alt: string;
  className?: string;
};

/**
 * 搭配兜底预览：没有实穿照也没有拼合图时，
 * 用前 1~4 件单品的白底图拼成一个示意图（1 件居中 / 2 件并排 / 3~4 件 2×2）。
 * 只是占位视觉，和画布排版无关。
 */
export function FallbackGrid({ urls, alt, className }: Props) {
  const list = urls.filter((url): url is string => Boolean(url)).slice(0, 4);

  if (list.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
          className,
        )}
      >
        <span className="text-[11px]">暂无图片</span>
      </div>
    );
  }

  const cell = (url: string, index: number) => (
    <div
      key={`${url}-${index}`}
      className="flex min-h-0 min-w-0 items-center justify-center"
    >
      <CosImage
        src={url}
        alt={`${alt} 单品 ${index + 1}`}
        className="h-full w-full object-contain"
      />
    </div>
  );

  return (
    <div
      className={cn(
        "grid gap-1.5 bg-white p-3",
        list.length === 1 && "grid-cols-1",
        list.length === 2 && "grid-cols-2",
        list.length >= 3 && "grid-cols-2 grid-rows-2",
        className,
      )}
    >
      {list.map(cell)}
    </div>
  );
}
