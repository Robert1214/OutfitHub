"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CosImage } from "@/components/wardrobe/cos-image";
import { CATEGORY_LABELS } from "@/lib/validations/wardrobe";
import { cn } from "@/lib/utils";

export type TryonSelectableItem = {
  id: string;
  name: string;
  category: "TOP" | "BOTTOM" | "SHOES" | "ACCESSORY";
  thumbUrl: string | null;
};

type Props = {
  items: TryonSelectableItem[];
  /** 从单品详情「试穿这件」带过来的 id */
  initialItemIds: string[];
  /** 人像预览（签名 URL） */
  photoUrl: string | null;
  /** 每日额度 */
  quota: { used: number; limit: number; remaining: number };
};

const MAX_ITEMS = 4;
const MIN_ITEMS = 1;
const POLL_INTERVAL = 2000;

type Phase = "idle" | "starting" | "generating" | "done" | "failed";

export function TryonWorkbench({
  items,
  initialItemIds,
  photoUrl,
  quota: initialQuota,
}: Props) {
  const [selected, setSelected] = useState<string[]>(
    initialItemIds.slice(0, MAX_ITEMS),
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [recordId, setRecordId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [quota, setQuota] = useState(initialQuota);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const busy = phase === "starting" || phase === "generating";

  // 已等待秒数
  useEffect(() => {
    if (!busy) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [busy]);

  /** 轮询结果，直到成功/失败 */
  useEffect(() => {
    if (!recordId || phase !== "generating") return;
    let cancelled = false;

    async function tick() {
      if (cancelled) return;
      try {
        const response = await fetch(`/api/tryon/${recordId}`);
        const data = (await response.json().catch(() => ({}))) as {
          status?: string;
          resultUrl?: string | null;
          error?: string;
        };
        if (cancelled) return;

        if (!response.ok) {
          setPhase("failed");
          setError(data.error ?? "查询失败，请重试");
          return;
        }

        if (data.status === "SUCCEEDED" && data.resultUrl) {
          setResultUrl(data.resultUrl);
          setPhase("done");
          toast.success("试穿完成");
          return;
        }
        if (data.status === "FAILED") {
          setPhase("failed");
          setError(data.error ?? "生成失败，请重试");
          return;
        }
        setTimeout(tick, POLL_INTERVAL);
      } catch {
        if (!cancelled) setTimeout(tick, POLL_INTERVAL * 2);
      }
    }

    tick();
    return () => {
      cancelled = true;
    };
  }, [recordId, phase]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      if (prev.length >= MAX_ITEMS) {
        toast.error(`最多选 ${MAX_ITEMS} 件`);
        return prev;
      }
      return [...prev, id];
    });
    // 换单品后重置结果
    if (phase === "done" || phase === "failed") {
      setPhase("idle");
      setResultUrl(null);
      setError(null);
    }
  }

  async function generate() {
    if (!photoUrl) {
      toast.error("请先在个人中心上传本人照片");
      return;
    }
    if (selected.length < MIN_ITEMS) {
      toast.error(`至少选 ${MIN_ITEMS} 件`);
      return;
    }
    if (quota.remaining <= 0) {
      toast.error("今天的试穿次数用完了");
      return;
    }

    setPhase("starting");
    setError(null);
    setResultUrl(null);
    setElapsed(0);

    try {
      const response = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: selected }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        recordId?: string;
        quota?: typeof quota;
        error?: string;
      };

      if (!response.ok || !data.recordId) {
        setPhase("failed");
        setError(data.error ?? "发起失败，请重试");
        return;
      }

      if (data.quota) setQuota(data.quota);
      setRecordId(data.recordId);
      setPhase("generating");
    } catch {
      setPhase("failed");
      setError("网络异常，请重试");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      {/* 左：结果区 */}
      <div className="space-y-3">
        <div className="relative mx-auto aspect-[3/4] max-h-[70vh] w-full max-w-md overflow-hidden rounded-xl border bg-white">
          {phase === "done" && resultUrl ? (
            <>
              <CosImage
                src={resultUrl}
                alt="试穿结果"
                fallbackText="结果加载失败"
                className="h-full w-full object-contain"
              />
              <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
                AI 生成
              </span>
            </>
          ) : busy ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-sm font-medium">
                {phase === "starting" ? "准备素材…" : "正在生成…"}
              </p>
              <p className="text-xs text-muted-foreground">
                已等待 {elapsed} 秒，通常需要 50~90 秒
              </p>
              <p className="text-xs text-muted-foreground">
                可以刷新页面，进度不会丢
              </p>
            </div>
          ) : phase === "failed" ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm font-medium text-destructive">生成失败</p>
              <p className="text-xs text-muted-foreground">{error}</p>
              <Button size="sm" variant="outline" onClick={generate}>
                重新生成
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
              <p className="text-sm">选 1~4 件单品，点「开始试穿」</p>
              <p className="text-xs">每次生成约 1 元，每人每天 5 次</p>
            </div>
          )}
        </div>

        {phase === "done" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={generate} variant="outline" size="sm">
              重新生成
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setPhase("idle");
                setResultUrl(null);
              }}
            >
              返回调整
            </Button>
            <Link
              href="/account/tryons"
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              查看试穿历史 →
            </Link>
          </div>
        ) : null}
      </div>

      {/* 右：选品 + 人像 */}
      <aside className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">选择单品</p>
            <span className="text-xs text-muted-foreground">
              {selected.length} / {MAX_ITEMS}
            </span>
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
              衣橱还没有单品
            </p>
          ) : (
            <ul className="grid max-h-80 grid-cols-4 gap-1.5 overflow-y-auto pr-1">
              {items.map((item) => {
                const index = selected.indexOf(item.id);
                const active = index !== -1;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      disabled={busy}
                      title={`${item.name}（${CATEGORY_LABELS[item.category]}）`}
                      className={cn(
                        "relative block aspect-[4/5] w-full overflow-hidden rounded-md border bg-white transition-colors disabled:opacity-50",
                        active ? "ring-2 ring-primary" : "hover:bg-muted/40",
                      )}
                    >
                      <CosImage
                        src={item.thumbUrl}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                      {active ? (
                        <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] text-primary-foreground">
                          {index + 1}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">本人照片</p>
          <div className="flex items-center gap-3">
            <div className="size-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
              <CosImage
                src={photoUrl}
                alt="本人照片"
                fallbackText="未上传"
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1 text-xs text-muted-foreground">
              {photoUrl ? (
                <Link
                  href="/account"
                  className="text-foreground underline underline-offset-4"
                >
                  更换照片
                </Link>
              ) : (
                <>
                  还没上传，
                  <Link
                    href="/account"
                    className="text-foreground underline underline-offset-4"
                  >
                    去个人中心上传
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">今日额度</span>
            <span>
              {quota.used} / {quota.limit}
            </span>
          </div>
          <p className="text-[11px] leading-4 text-muted-foreground">
            每次生成约 1 元（腾讯云按张计费）
          </p>
          <Button
            className="w-full"
            onClick={generate}
            disabled={busy || selected.length < MIN_ITEMS || quota.remaining <= 0}
          >
            {busy
              ? "生成中…"
              : quota.remaining <= 0
                ? "今日次数已用完"
                : `开始试穿（${selected.length} 件）`}
          </Button>
        </div>
      </aside>
    </div>
  );
}
