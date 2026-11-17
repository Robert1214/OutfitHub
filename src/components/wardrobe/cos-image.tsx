"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null;
  alt: string;
  className?: string;
  /** 加载失败时的提示文案 */
  fallbackText?: string;
  loading?: "eager" | "lazy";
};

/**
 * COS 图片组件：签名 URL 过期或对象被删时，显示占位提示而不是浏览器破图图标。
 * 签名 URL 域名随桶变化，用原生 img 避免配置 next/image remotePatterns。
 */
export function CosImage({
  src,
  alt,
  className,
  fallbackText = "图片已失效",
  loading = "lazy",
}: Props) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-muted-foreground">
        <ImageOff className="size-5" aria-hidden />
        <span className="px-2 text-center text-[11px] leading-4">
          {src ? fallbackText : "暂无图片"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading={loading}
      onError={() => setFailed(true)}
      className={cn(className)}
    />
  );
}
