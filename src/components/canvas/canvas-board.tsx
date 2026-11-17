"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BASE_WIDTH_RATIO,
  MAX_SCALE,
  MIN_SCALE,
  type CanvasElement,
  type ItemCategory,
} from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

export type CanvasItemMeta = {
  itemId: string;
  name: string;
  category: ItemCategory;
  /** 白底图签名 URL */
  url: string | null;
  /** 图片宽高比，用于保持比例 */
  aspectRatio: number;
};

type Props = {
  elements: CanvasElement[];
  meta: Record<string, CanvasItemMeta>;
  selectedId: string | null;
  onSelect: (itemId: string | null) => void;
  onChange: (elements: CanvasElement[]) => void;
  /** 一次交互结束（松手）时调用，用于压入撤销栈 */
  onCommit?: () => void;
  disabled?: boolean;
};

type DragState =
  | { mode: "move"; itemId: string; startX: number; startY: number; originX: number; originY: number }
  | {
      mode: "scale";
      itemId: string;
      corner: "nw" | "ne" | "sw" | "se";
      startScale: number;
      startDistance: number;
      centerX: number;
      centerY: number;
    }
  | {
      mode: "rotate";
      itemId: string;
      startRotation: number;
      startAngle: number;
      centerX: number;
      centerY: number;
    };

/** 指针到画布中心的夹角（度） */
function angleOf(px: number, py: number, cx: number, cy: number): number {
  return (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
}

export function CanvasBoard({
  elements,
  meta,
  selectedId,
  onSelect,
  onChange,
  onCommit,
  disabled = false,
}: Props) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  /** 相对画布的比例坐标（0~1） */
  const toRelative = useCallback((clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0.5, y: 0.5 };
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, []);

  const update = useCallback(
    (itemId: string, patch: Partial<CanvasElement>) => {
      onChange(
        elements.map((element) =>
          element.itemId === itemId ? { ...element, ...patch } : element,
        ),
      );
    },
    [elements, onChange],
  );

  /** 拖拽 / 缩放 / 旋转的全局指针处理 */
  useEffect(() => {
    if (!drag) return;

    function handleMove(event: PointerEvent) {
      if (!drag) return;
      const point = toRelative(event.clientX, event.clientY);

      if (drag.mode === "move") {
        const nextX = drag.originX + (point.x - drag.startX);
        const nextY = drag.originY + (point.y - drag.startY);
        // 允许略微出界，但不能完全拖丢
        update(drag.itemId, {
          x: Math.min(1.1, Math.max(-0.1, nextX)),
          y: Math.min(1.1, Math.max(-0.1, nextY)),
        });
        return;
      }

      if (drag.mode === "scale") {
        const distance = Math.hypot(
          point.x - drag.centerX,
          point.y - drag.centerY,
        );
        if (drag.startDistance <= 0) return;
        const ratio = distance / drag.startDistance;
        const nextScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, drag.startScale * ratio),
        );
        update(drag.itemId, { scale: Number(nextScale.toFixed(3)) });
        return;
      }

      if (drag.mode === "rotate") {
        const current = angleOf(
          point.x,
          point.y,
          drag.centerX,
          drag.centerY,
        );
        let next = drag.startRotation + (current - drag.startAngle);
        // 归一化到 -180~180
        while (next > 180) next -= 360;
        while (next < -180) next += 360;
        update(drag.itemId, { rotation: Math.round(next) });
      }
    }

    function handleUp() {
      setDrag(null);
      onCommit?.();
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [drag, onCommit, toRelative, update]);

  /** 滚轮缩放（选中元素时） */
  function handleWheel(event: React.WheelEvent) {
    if (!selectedId || disabled) return;
    const target = elements.find((element) => element.itemId === selectedId);
    if (!target) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.05 : 0.05;
    const nextScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, target.scale + delta),
    );
    update(selectedId, { scale: Number(nextScale.toFixed(3)) });
    onCommit?.();
  }

  /** 键盘微调 */
  function handleKeyDown(event: React.KeyboardEvent) {
    if (!selectedId || disabled) return;
    const target = elements.find((element) => element.itemId === selectedId);
    if (!target) return;
    const step = event.shiftKey ? 0.01 : 0.001;
    let handled = true;

    switch (event.key) {
      case "ArrowLeft":
        update(selectedId, { x: target.x - step });
        break;
      case "ArrowRight":
        update(selectedId, { x: target.x + step });
        break;
      case "ArrowUp":
        update(selectedId, { y: target.y - step });
        break;
      case "ArrowDown":
        update(selectedId, { y: target.y + step });
        break;
      case "Delete":
      case "Backspace":
        setHint("用上方「移除」按钮删除元素");
        handled = false;
        break;
      default:
        handled = false;
    }
    if (handled) {
      event.preventDefault();
      onCommit?.();
    }
  }

  const ordered = useMemo(
    () => [...elements].sort((a, b) => a.zIndex - b.zIndex),
    [elements],
  );

  return (
    <div className="space-y-2">
      <div
        ref={boardRef}
        tabIndex={0}
        role="application"
        aria-label="搭配画布"
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          // 点空白取消选中
          if (event.target === event.currentTarget) onSelect(null);
        }}
        className={cn(
          "relative aspect-square w-full touch-none select-none overflow-hidden rounded-xl border bg-white outline-none focus-visible:ring-2 focus-visible:ring-ring",
          disabled && "pointer-events-none opacity-60",
        )}
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(0,0,0,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.035) 1px, transparent 1px)",
          backgroundSize: "8.333% 8.333%",
        }}
      >
        {ordered.map((element) => {
          const info = meta[element.itemId];
          if (!info) return null;
          const isSelected = element.itemId === selectedId;
          const widthPercent = BASE_WIDTH_RATIO[info.category] * element.scale * 100;

          return (
            <div
              key={element.itemId}
              style={{
                left: `${element.x * 100}%`,
                top: `${element.y * 100}%`,
                width: `${widthPercent}%`,
                transform: `translate(-50%, -50%) rotate(${element.rotation}deg)`,
                zIndex: element.zIndex,
              }}
              className={cn(
                "absolute cursor-move",
                isSelected && "ring-2 ring-primary ring-offset-2",
              )}
              onPointerDown={(event) => {
                if (disabled) return;
                event.stopPropagation();
                onSelect(element.itemId);
                const point = toRelative(event.clientX, event.clientY);
                setDrag({
                  mode: "move",
                  itemId: element.itemId,
                  startX: point.x,
                  startY: point.y,
                  originX: element.x,
                  originY: element.y,
                });
              }}
            >
              {info.url ? (
                // 签名 URL 域名随 COS 桶变化
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={info.url}
                  alt={info.name}
                  draggable={false}
                  className="pointer-events-none block h-auto w-full"
                />
              ) : (
                <div
                  className="flex items-center justify-center bg-muted text-[10px] text-muted-foreground"
                  style={{ aspectRatio: info.aspectRatio }}
                >
                  {info.name}
                </div>
              )}

              {isSelected ? (
                <>
                  {/* 四角缩放手柄 */}
                  {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                    <span
                      key={corner}
                      onPointerDown={(event) => {
                        event.stopPropagation();
                        const rect = boardRef.current?.getBoundingClientRect();
                        if (!rect) return;
                        const point = toRelative(event.clientX, event.clientY);
                        setDrag({
                          mode: "scale",
                          itemId: element.itemId,
                          corner,
                          startScale: element.scale,
                          startDistance: Math.max(
                            0.01,
                            Math.hypot(point.x - element.x, point.y - element.y),
                          ),
                          centerX: element.x,
                          centerY: element.y,
                        });
                      }}
                      className={cn(
                        "absolute size-3 rounded-full border-2 border-primary bg-white",
                        corner === "nw" && "-left-1.5 -top-1.5 cursor-nwse-resize",
                        corner === "ne" && "-right-1.5 -top-1.5 cursor-nesw-resize",
                        corner === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                        corner === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
                      )}
                    />
                  ))}
                  {/* 旋转手柄 */}
                  <span
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      const point = toRelative(event.clientX, event.clientY);
                      setDrag({
                        mode: "rotate",
                        itemId: element.itemId,
                        startRotation: element.rotation,
                        startAngle: angleOf(point.x, point.y, element.x, element.y),
                        centerX: element.x,
                        centerY: element.y,
                      });
                    }}
                    className="absolute -top-7 left-1/2 size-3 -translate-x-1/2 cursor-grab rounded-full border-2 border-primary bg-white"
                    aria-label="旋转"
                  />
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          拖动移动 · 四角缩放 · 顶部圆点旋转 · 方向键微调（Shift 加速）· 滚轮缩放
        </p>
      )}
    </div>
  );
}
