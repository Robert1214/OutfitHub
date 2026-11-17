"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  CanvasBoard,
  type CanvasItemMeta,
} from "@/components/canvas/canvas-board";
import type { CanvasElement } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

type Props = {
  lookId: string;
  /** 初始画布（DB 里的或自动排版的） */
  initialElements: CanvasElement[];
  meta: Record<string, CanvasItemMeta>;
  /** 自动排版的原始结果，用于「恢复自动排版」 */
  autoElements: CanvasElement[];
};

const MAX_HISTORY = 30;

export function CanvasEditor({
  lookId,
  initialElements,
  meta,
  autoElements,
}: Props) {
  const [elements, setElements] = useState<CanvasElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<CanvasElement[]>(initialElements);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [saving, setSaving] = useState(false);
  const [collageUrl, setCollageUrl] = useState<string | null>(null);
  const snapshotRef = useRef<CanvasElement[]>(initialElements);

  const dirty = useMemo(
    () => JSON.stringify(elements) !== JSON.stringify(saved),
    [elements, saved],
  );

  /** 每次交互结束压栈 */
  const pushHistory = useCallback(() => {
    setHistory((prev) => {
      const next = [...prev, snapshotRef.current];
      return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
    });
    snapshotRef.current = elements;
  }, [elements]);

  /** 撤销 */
  const undo = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setElements(last);
      snapshotRef.current = last;
      return prev.slice(0, -1);
    });
  }, []);

  /** Ctrl/Cmd+Z 与 Ctrl/Cmd+S */
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  /** 未保存离开提醒 */
  useEffect(() => {
    if (!dirty) return;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function moveLayer(direction: 1 | -1) {
    if (!selectedId) return;
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const index = sorted.findIndex((element) => element.itemId === selectedId);
    const swapWith = index + direction;
    if (index === -1 || swapWith < 0 || swapWith >= sorted.length) return;

    const a = sorted[index];
    const b = sorted[swapWith];
    setElements(
      elements.map((element) => {
        if (element.itemId === a.itemId) return { ...element, zIndex: b.zIndex };
        if (element.itemId === b.itemId) return { ...element, zIndex: a.zIndex };
        return element;
      }),
    );
    pushHistory();
  }

  function resetCanvas() {
    if (!window.confirm("恢复自动排版？当前摆放会丢失。")) return;
    pushHistory();
    setElements(autoElements);
    setSelectedId(null);
    toast.success("已恢复自动排版");
  }

  function removeItem(itemId: string) {
    pushHistory();
    const next = elements
      .filter((element) => element.itemId !== itemId)
      .map((element, index) => ({ ...element, zIndex: index + 1 }));
    setElements(next);
    setSelectedId(null);
  }

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/looks/${lookId}/canvas`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elements }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        collageUrl?: string;
        error?: string;
      };
      if (!response.ok) {
        toast.error(data.error ?? "保存失败，请重试");
        return;
      }
      setSaved(elements);
      setCollageUrl(data.collageUrl ?? null);
      toast.success("排版已保存，白底拼合图已生成");
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setSaving(false);
    }
  }

  const selected = elements.find((element) => element.itemId === selectedId);
  const selectedMeta = selectedId ? meta[selectedId] : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <div>
        <CanvasBoard
          elements={elements}
          meta={meta}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onChange={setElements}
          onCommit={pushHistory}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
          >
            {saving ? "保存中…" : dirty ? "保存排版" : "已保存"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={undo}
            disabled={history.length === 0}
          >
            撤销
          </Button>
          <Button type="button" variant="outline" onClick={resetCanvas}>
            恢复自动排版
          </Button>
          {dirty ? (
            <span className="text-xs text-muted-foreground">有未保存的改动</span>
          ) : null}
        </div>
      </div>

      <aside className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">选中元素</p>
          {selected && selectedMeta ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="line-clamp-1 text-sm">{selectedMeta.name}</p>

              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => moveLayer(1)}
                >
                  上移一层
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => moveLayer(-1)}
                >
                  下移一层
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => removeItem(selected.itemId)}
                >
                  移除
                </Button>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">缩放</span>
                  <span>{selected.scale.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={300}
                  value={Math.round(selected.scale * 100)}
                  onChange={(event) => {
                    const next = Number(event.target.value) / 100;
                    setElements(
                      elements.map((element) =>
                        element.itemId === selected.itemId
                          ? { ...element, scale: next }
                          : element,
                      ),
                    );
                  }}
                  onPointerUp={pushHistory}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">旋转</span>
                  <span>{selected.rotation}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selected.rotation}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    setElements(
                      elements.map((element) =>
                        element.itemId === selected.itemId
                          ? { ...element, rotation: next }
                          : element,
                      ),
                    );
                  }}
                  onPointerUp={pushHistory}
                  className="w-full accent-primary"
                />
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              点一下画布里的单品来选中它
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">元素列表</p>
          <ul className="space-y-1">
            {[...elements]
              .sort((a, b) => b.zIndex - a.zIndex)
              .map((element) => (
                <li key={element.itemId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(element.itemId)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md border p-1.5 text-left text-xs transition-colors",
                      element.itemId === selectedId
                        ? "border-primary bg-muted"
                        : "hover:bg-muted/50",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-white">
                      {meta[element.itemId]?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={meta[element.itemId].url ?? ""}
                          alt=""
                          className="h-full w-full object-contain"
                        />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {meta[element.itemId]?.name ?? element.itemId}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      z{element.zIndex}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>

        {collageUrl ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">最近生成的拼合图</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={collageUrl}
              alt="白底拼合图"
              className="w-full rounded-lg border bg-white"
            />
          </div>
        ) : null}
      </aside>
    </div>
  );
}
