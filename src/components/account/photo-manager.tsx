"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const MAX_BYTES = 8 * 1024 * 1024;
const MIN_DIMENSION = 200;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.width, height: image.height });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片无法识别，请换一张"));
    };
    image.src = url;
  });
}

export function PhotoManager({ initialUrl }: { initialUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("只支持 JPG / PNG / WebP 格式");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("图片超过 8MB，请换一张");
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const size = await imageSize(file);
      if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
        setError("图片太小，可能看不清主体，请换一张清晰的照片");
        setBusy(false);
        return;
      }

      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/account/photo", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !data.url) {
        setError(data.error ?? "照片上传失败，请稍后重试");
        setBusy(false);
        return;
      }

      setUrl(data.url);
      toast.success("照片已更新");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "照片上传失败，请稍后重试",
      );
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!window.confirm("确定删除本人照片吗？删除后试穿前需要重新上传。")) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/photo", { method: "DELETE" });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "删除失败，请稍后重试");
        return;
      }
      setUrl(null);
      toast.success("照片已删除");
    } catch {
      setError("删除失败，请稍后重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3">
      <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted">
        {url ? (
          // Signed COS URL 的域名随桶变化，这里用原生 img，避免配置 next/image remotePatterns。
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="本人照片"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-muted-foreground">
            <span className="text-xl">＋</span>
            <span>未上传</span>
          </div>
        )}
        {busy ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 text-xs">
            处理中…
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={url ? "outline" : "default"}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {url ? "更换照片" : "上传照片"}
          </Button>
          {url ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={removePhoto}
            >
              删除
            </Button>
          ) : null}
        </div>

        <p className="text-xs leading-5 text-muted-foreground">
          JPG / PNG / WebP，≤8MB，≥200×200；全身 / 半身 / 大头均可。
          存 COS 私有桶，可随时删除。
        </p>

        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </div>
  );
}
