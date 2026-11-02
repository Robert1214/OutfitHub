"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const REFUNDABLE = ["PAID_DEMO", "SHIPPED_DEMO", "COMPLETED"];
const CANCELLABLE = ["PENDING_PAYMENT"];

export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const refundable = REFUNDABLE.includes(status);
  const cancellable = CANCELLABLE.includes(status);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!refundable && !cancellable) return null;

  const action = refundable ? "refund" : "cancel";

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${orderId}/${action}`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
          return;
        }
        setError(data.error ?? "操作失败，请稍后重试");
        return;
      }

      setOpen(false);
      toast.success(
        action === "refund"
          ? "已退款（演示），商品已恢复在售"
          : "订单已取消（演示）",
      );
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {action === "refund" ? "申请退款（演示）" : "取消订单（演示）"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "refund" ? "确认申请退款" : "确认取消订单"}
            </DialogTitle>
            <DialogDescription>
              {action === "refund"
                ? "演示退款，不涉及真实资金。确认后订单变为「已退款（演示）」，商品恢复为在售。"
                : "演示操作。确认后订单变为「已取消」，商品恢复为在售。"}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              返回
            </Button>
            <Button onClick={() => void submit()} disabled={busy}>
              {busy
                ? "处理中…"
                : action === "refund"
                  ? "确认退款（演示）"
                  : "确认取消（演示）"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
