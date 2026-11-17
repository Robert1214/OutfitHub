"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import Link from "next/link";

type Props = {
  look: { id: string; name: string };
};

/** 搭配详情操作：编辑排版 / 编辑信息 / 删除 */
export function LookActions({ look }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (
      !window.confirm(
        `确定删除「${look.name}」吗？实穿照与拼合图会一并从云端删除，不可恢复。`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/looks/${look.id}`, {
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
      router.push("/looks");
      router.refresh();
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={`/looks/${look.id}/edit`}
        className={buttonVariants({ variant: "default", size: "sm" })}
      >
        编辑排版
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={handleDelete}
        className="text-destructive hover:text-destructive"
      >
        {busy ? "删除中…" : "删除"}
      </Button>
    </div>
  );
}
