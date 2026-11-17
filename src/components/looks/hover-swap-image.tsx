"use client";

import { useState } from "react";
import { ImageOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  /** 默认显示（实穿照） */
  front: string | null;
  /** 悬停/点击切换（白底拼合图） */
  back: string | null;
  alt: string;
  /** 外层容器类名（控制比例，如 aspect-[4/5]） */
  className?: string;
  /** 图片 object-fit，默认 cover（实穿照）；拼合图建议 contain */
  fit?: "cover" | "contain";
  /** 是否显示右上角切换按钮（默认只在有 back 时显示） */
  showToggle?: boolean;
  /** 加载失败文案 */
  fallbackText?: string;
  priority?: boolean;
};

/**
 * 悬停双视角（PRD §3.6）：
 * - 默认显示实穿照
 * - 桌面悬停淡入白底拼合图（250ms 交叉淡入，不位移）
 * - 移动端无 hover → 右上角切换按钮
 * - 缺图只显示存在的那张，不报错
 */
export function HoverSwapImage({
  front,
  back,
  alt,
  className,
  fit = "contain",
  showToggle = true,
  fallbackText = "图片已失效",
  priority = false,
}: Props) {
  const [flipped, setFlipped] = useState(false);
  const [failed, setFailed] = useState<"front" | "back" | null>(null);

  const hasFront = Boolean(front) && failed !== "front";
  const hasBack = Boolean(back) && failed !== "back";

  // 缺图：只显示存在的那张
  if (!hasFront && !hasBack) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
          className,
        )}
      >
        <ImageOff className="size-5" aria-hidden />
        <span className="text-[11px]">{fallbackText}</span>
      </div>
    );
  }

  const onlyOne = !hasFront || !hasBack;
  const showingBack = onlyOne ? !hasFront : flipped;

  return (
    <div className={cn("group relative overflow-hidden bg-white", className)}>
      {hasFront ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={front ?? ""}
          alt={alt}
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailed("front")}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-250",
            fit === "cover" ? "object-cover" : "object-contain",
            showingBack ? "opacity-0" : "opacity-100",
            // 桌面悬停：移到 back 上
            hasBack && !onlyOne && "group-hover:opacity-0",
          )}
        />
      ) : null}

      {hasBack ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={back ?? ""}
          alt={`${alt}（白底拼合图）`}
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailed("back")}
          className={cn(
            "absolute inset-0 h-full w-full transition-opacity duration-250",
            fit === "cover" ? "object-cover" : "object-contain",
            showingBack ? "opacity-100" : "opacity-0",
            hasFront && !onlyOne && "group-hover:opacity-100",
          )}
        />
      ) : null}

      {/* 移动端切换按钮：有 hover 的设备不需要动手点，但保留也无害 */}
      {showToggle && hasFront && hasBack ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setFlipped((value) => !value);
          }}
          className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full bg-background/85 px-2 py-1 text-[10px] text-foreground shadow-sm backdrop-blur transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
          aria-label={flipped ? "查看实穿照" : "查看白底拼合图"}
        >
          <RefreshCw className="size-3" />
          {flipped ? "实穿照" : "白底图"}
        </button>
      ) : null}
    </div>
  );
}
