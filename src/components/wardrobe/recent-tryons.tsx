"use client";

import Link from "next/link";
import { CosImage } from "@/components/wardrobe/cos-image";
import { cn } from "@/lib/utils";

export type RecentTryonCard = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  resultUrl: string | null;
  createdAtLabel: string;
  itemCount: number;
  itemNames: string[];
};

const STATUS_LABEL: Record<RecentTryonCard["status"], string> = {
  PENDING: "排队中",
  RUNNING: "生成中",
  SUCCEEDED: "已完成",
  FAILED: "失败",
};

/** New 区顶部「最近试穿」横滑条（最近 6 次） */
export function RecentTryons({ tryons }: { tryons: RecentTryonCard[] }) {
  if (tryons.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm text-muted-foreground">
          还没有试穿记录，挑一件试试看
        </p>
        <Link
          href="/tryon"
          className="mt-2 inline-block text-xs text-foreground underline underline-offset-4"
        >
          去试穿
        </Link>
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <ul className="flex gap-3">
        {tryons.map((tryon) => (
          <li key={tryon.id} className="shrink-0">
            <Link
              href={`/account/tryons`}
              className="group block w-28"
              title={tryon.itemNames.join("、")}
            >
              <div
                className={cn(
                  "aspect-[3/4] overflow-hidden rounded-lg border bg-white",
                  tryon.status === "FAILED" && "opacity-60",
                )}
              >
                <CosImage
                  src={tryon.resultUrl}
                  alt={tryon.itemNames.join("、") || "试穿结果"}
                  fallbackText={STATUS_LABEL[tryon.status]}
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">
                {tryon.createdAtLabel}
              </p>
              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                {tryon.itemCount} 件 · {STATUS_LABEL[tryon.status]}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
