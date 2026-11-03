"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getSizeAdvice,
  type BodyMetrics,
  type SizeProduct,
} from "@/lib/size-engine";
import { cn } from "@/lib/utils";

const EMPTY_BODY: BodyMetrics = {
  heightCm: null,
  bustCm: null,
  waistCm: null,
  hipCm: null,
};

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function SizeAdvice({
  product,
  initialBody,
  isLoggedIn,
}: {
  product: SizeProduct & { slug: string };
  initialBody: BodyMetrics | null;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState<BodyMetrics>(initialBody ?? EMPTY_BODY);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const advice = getSizeAdvice(body, product);

  function openEditor() {
    if (!isLoggedIn) {
      toast.info("登录后可以填写身材信息");
      router.push(
        `/login?next=${encodeURIComponent(`/products/${product.slug}`)}`,
      );
      return;
    }
    setError("");
    setExpanded(true);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const formData = new FormData(event.currentTarget);
    const payload: BodyMetrics = {
      heightCm: numberOrNull(formData.get("heightCm")),
      bustCm: numberOrNull(formData.get("bustCm")),
      waistCm: numberOrNull(formData.get("waistCm")),
      hipCm: numberOrNull(formData.get("hipCm")),
    };

    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account/body", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        body?: BodyMetrics;
      };
      if (!response.ok) {
        if (response.status === 401) {
          router.push(
            `/login?next=${encodeURIComponent(`/products/${product.slug}`)}`,
          );
          return;
        }
        setError(data.error ?? "保存失败，请稍后重试");
        return;
      }
      if (data.body) setBody(data.body);
      setExpanded(false);
      toast.success("身材信息已保存");
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b pb-3">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <span className="text-muted-foreground">尺码建议</span>
            {advice.kind === "missing-body" ? (
              <button
                type="button"
                onClick={openEditor}
                className="text-xs text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {advice.summary}
              </button>
            ) : (
              <span
                className={cn(
                  "text-xs font-medium",
                  advice.tone === "ok" && "text-emerald-600",
                  advice.tone === "warn" && "text-amber-600",
                  advice.tone === "muted" && "text-muted-foreground",
                )}
              >
                {advice.summary}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {advice.detail}
          </p>

          {advice.kind === "fit" && !expanded ? (
            <button
              type="button"
              onClick={openEditor}
              className="mt-1 text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              修改身材信息
            </button>
          ) : null}

          {expanded ? (
            <form
              onSubmit={save}
              className="mt-3 rounded-lg border bg-background p-3"
            >
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["heightCm", "身高 cm", 130, 210],
                    ["bustCm", "胸围 cm", 60, 160],
                    ["waistCm", "腰围 cm", 40, 140],
                    ["hipCm", "臀围 cm", 60, 160],
                  ] as const
                ).map(([name, label, min, max]) => (
                  <div key={name} className="space-y-1">
                    <Label htmlFor={`advice-${name}`} className="text-xs">
                      {label}
                    </Label>
                    <Input
                      id={`advice-${name}`}
                      name={name}
                      type="number"
                      inputMode="numeric"
                      min={min}
                      max={max}
                      defaultValue={body[name] ?? ""}
                      className="h-8"
                      placeholder="选填"
                    />
                  </div>
                ))}
              </div>
              {error ? (
                <p role="alert" className="mt-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <div className="mt-3 flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {busy ? "保存中…" : "保存"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setExpanded(false);
                    setError("");
                  }}
                >
                  取消
                </Button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
