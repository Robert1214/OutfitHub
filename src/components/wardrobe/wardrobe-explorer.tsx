"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  WardrobeGrid,
  type WardrobeCardItem,
} from "@/components/wardrobe/wardrobe-grid";

const MIN_ITEMS = 2;
const MAX_ITEMS = 8;

type Props = {
  items: WardrobeCardItem[];
  /** 进入页面时的多选状态（URL 不带，仅内存） */
  initialSelected?: string[];
};

/**
 * 衣橱网格 + 多选模式。
 * 勾选 2~8 件后出现「生成搭配」，带上 itemIds 跳 /looks/new（第 7 步的画布入口）。
 */
export function WardrobeExplorer({ items, initialSelected = [] }: Props) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const selectedItems = useMemo(
    () =>
      selected
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is WardrobeCardItem => Boolean(item)),
    [items, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      if (prev.length >= MAX_ITEMS) {
        toast.error(`最多选 ${MAX_ITEMS} 件`);
        return prev;
      }
      return [...prev, id];
    });
  }

  function exitSelecting() {
    setSelecting(false);
    setSelected([]);
  }

  function generateLook() {
    if (selected.length < MIN_ITEMS) {
      toast.error(`至少选 ${MIN_ITEMS} 件`);
      return;
    }
    router.push(`/looks/new?items=${selected.join(",")}`);
  }

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">共 {items.length} 件</p>
        <div className="flex items-center gap-2">
          {selecting ? (
            <>
              <span className="text-xs text-muted-foreground">
                已选 {selected.length} / {MAX_ITEMS}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
                disabled={selected.length === 0}
              >
                清空
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={exitSelecting}>
                取消
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelecting(true)}
              disabled={items.length < MIN_ITEMS}
            >
              多选搭配
            </Button>
          )}
        </div>
      </div>

      <WardrobeGrid
        items={items}
        selected={selecting ? selected : []}
        onToggle={selecting ? toggle : undefined}
      />

      {/* 多选时的浮动操作栏 */}
      {selecting ? (
        <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-lg backdrop-blur">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectedItems.length === 0 ? (
              <span className="text-sm text-muted-foreground">
                点选 2~8 件单品
              </span>
            ) : (
              <div className="flex gap-1.5 overflow-x-auto">
                {selectedItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="relative size-12 shrink-0 overflow-hidden rounded-md border bg-muted"
                    title={item.name}
                  >
                    {item.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.coverUrl}
                        alt={item.name}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                    <span className="absolute left-0 top-0 bg-primary px-1 text-[10px] text-primary-foreground">
                      {index + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <Button
            type="button"
            onClick={generateLook}
            disabled={selected.length < MIN_ITEMS}
          >
            生成搭配
            {selected.length > 0 ? `（${selected.length}）` : ""}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
