"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CosImage } from "@/components/wardrobe/cos-image";

export type TryonHistoryItem = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  resultUrl: string | null;
  errorMessage: string | null;
  createdAtLabel: string;
  itemNames: string[];
  itemCount: number;
};

const STATUS_LABEL: Record<TryonHistoryItem["status"], string> = {
  PENDING: "排队中",
  RUNNING: "生成中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
};

/** 试穿历史网格：点开大图 + 删除 */
export function TryonHistory({ records }: { records: TryonHistoryItem[] }) {
  const router = useRouter();
  const [active, setActive] = useState<TryonHistoryItem | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(record: TryonHistoryItem) {
    if (!window.confirm("确定删除这条试穿记录吗？结果图会一并从云端删除。")) {
      return;
    }
    setDeleting(record.id);
    try {
      const response = await fetch(`/api/tryon/${record.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "删除失败，请重试");
        return;
      }
      toast.success("已删除");
      setActive(null);
      router.refresh();
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {records.map((record) => (
          <li key={record.id}>
            <button
              type="button"
              onClick={() => setActive(record)}
              className="group block w-full text-left"
            >
              <div className="relative aspect-[3/4] overflow-hidden rounded-xl border bg-white">
                <CosImage
                  src={record.resultUrl}
                  alt={record.itemNames.join("、") || "试穿结果"}
                  fallbackText={STATUS_LABEL[record.status]}
                  className="h-full w-full object-cover"
                />
                {record.status === "SUCCEEDED" ? (
                  <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                    AI 生成
                  </span>
                ) : (
                  <span className="absolute left-2 top-2 rounded bg-background/85 px-1.5 py-0.5 text-[10px]">
                    {STATUS_LABEL[record.status]}
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {record.createdAtLabel} · {record.itemCount} 件
              </p>
              <p className="line-clamp-1 text-xs text-muted-foreground">
                {record.itemNames.join("、")}
              </p>
            </button>
          </li>
        ))}
      </ul>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setActive(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-full w-full max-w-lg overflow-auto rounded-xl bg-background p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative aspect-[3/4] overflow-hidden rounded-lg border bg-white">
              <CosImage
                src={active.resultUrl}
                alt={active.itemNames.join("、") || "试穿结果"}
                fallbackText={STATUS_LABEL[active.status]}
                className="h-full w-full object-contain"
              />
              {active.status === "SUCCEEDED" ? (
                <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
                  AI 生成
                </span>
              ) : null}
            </div>

            <div className="mt-3 space-y-1">
              <p className="text-sm font-medium">{active.itemNames.join("、")}</p>
              <p className="text-xs text-muted-foreground">
                {active.createdAtLabel} · {active.itemCount} 件
                {active.errorMessage ? ` · ${active.errorMessage}` : ""}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={deleting === active.id}
                onClick={() => void handleDelete(active)}
              >
                {deleting === active.id ? "删除中…" : "删除这条"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setActive(null)}
              >
                关闭
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
