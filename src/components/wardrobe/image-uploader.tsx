"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;
const MIN_DIMENSION = 200;
const MAX_IMAGES = 9;

export type UploadedImage = {
  /** 本地临时 id（上传前后都用它追踪） */
  localId: string;
  /** COS 原图 key */
  originalKey: string;
  /** COS 透明底 PNG key（去背景成功后才有的；画布叠图、试穿用） */
  whiteKey: string | null;
  /** COS 白底 PNG key（列表/详情展示用） */
  flatKey: string | null;
  /** 预览地址（优先白底版，签名 URL 或本地 blob） */
  previewUrl: string;
  /** 状态 */
  state: "uploading" | "ready" | "cutting" | "done" | "failed";
  /** 去背景失败/未处理时的提示 */
  message?: string;
  /** 自动提取的主色 */
  color?: string | null;
};

type Props = {
  /** 已保存的图（编辑页回填） */
  initialImages?: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  /** 主色回调（取第一张成功去背景的图） */
  onColorExtracted?: (color: string) => void;
  /** 分类专属拍摄提示（由表单按当前分类传入） */
  photoHint?: string;
};

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** 前端预检：类型 / 大小 / 尺寸（服务端仍会再查一遍） */
async function precheck(file: File): Promise<string | null> {
  if (!ACCEPTED.includes(file.type)) return "只支持 JPG / PNG / WebP 格式";
  if (file.size > MAX_BYTES) return `「${file.name}」超过 8MB，请压缩后再传`;

  const size = await new Promise<{ width: number; height: number } | null>(
    (resolve) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        resolve({ width: image.width, height: image.height });
        URL.revokeObjectURL(url);
      };
      image.onerror = () => {
        resolve(null);
        URL.revokeObjectURL(url);
      };
      image.src = url;
    },
  );
  if (!size) return `「${file.name}」无法识别，请换一张`;
  if (size.width < MIN_DIMENSION || size.height < MIN_DIMENSION) {
    return `「${file.name}」尺寸太小（${size.width}×${size.height}），至少 200×200`;
  }
  return null;
}

const STATE_LABEL: Record<UploadedImage["state"], string> = {
  uploading: "上传中…",
  ready: "待去背景",
  cutting: "去背景中…",
  done: "已去背景",
  failed: "去背景失败",
};

export function ImageUploader({
  initialImages = [],
  onChange,
  onColorExtracted,
  photoHint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<UploadedImage[]>(initialImages);
  const [dragging, setDragging] = useState(false);

  // 用 ref 保存回调，避免 onChange 变化导致重复触发
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current(images);
  }, [images]);

  const update = useCallback(
    (localId: string, patch: Partial<UploadedImage>) => {
      setImages((prev) =>
        prev.map((image) =>
          image.localId === localId ? { ...image, ...patch } : image,
        ),
      );
    },
    [],
  );

  /** 轮询去背景结果 */
  const pollCutout = useCallback(
    async (localId: string, taskId: string, originalKey: string) => {
      const deadline = Date.now() + 90_000;
      let interval = 1200;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, interval));
        interval = Math.min(interval * 1.2, 3000);

        let payload: {
          status?: string;
          whiteKey?: string;
          flatKey?: string;
          url?: string | null;
          flatUrl?: string | null;
          color?: string | null;
          error?: string;
        };
        try {
          const query = new URLSearchParams({ taskId, originalKey });
          const response = await fetch(`/api/wardrobe/cutout?${query}`);
          payload = await response.json();
          if (!response.ok) {
            update(localId, {
              state: "failed",
              message: payload.error ?? "去背景失败",
            });
            return;
          }
        } catch {
          update(localId, { state: "failed", message: "网络异常，请重试" });
          return;
        }

        if (payload.status === "SUCCEEDED" && payload.whiteKey) {
          update(localId, {
            state: "done",
            whiteKey: payload.whiteKey,
            flatKey: payload.flatKey ?? null,
            // 预览优先用白底版（不显示棋盘格透明底）
            previewUrl: payload.flatUrl ?? payload.url ?? undefined,
            color: payload.color ?? null,
            message: undefined,
          });
          if (payload.color) onColorExtracted?.(payload.color);
          return;
        }
        if (payload.status === "FAILED") {
          update(localId, {
            state: "failed",
            message: "去背景失败，可以重试或直接上传白底图",
          });
          return;
        }
      }
      update(localId, { state: "failed", message: "去背景超时，请重试" });
    },
    [onColorExtracted, update],
  );

  /** 发起去背景 */
  const startCutout = useCallback(
    async (localId: string, originalKey: string) => {
      update(localId, { state: "cutting", message: undefined });
      try {
        const response = await fetch("/api/wardrobe/cutout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ originalKey }),
        });
        const data = (await response.json().catch(() => ({}))) as {
          taskId?: string;
          error?: string;
        };
        if (!response.ok || !data.taskId) {
          update(localId, {
            state: "failed",
            message: data.error ?? "去背景失败，可以重试或直接上传白底图",
          });
          return;
        }
        await pollCutout(localId, data.taskId, originalKey);
      } catch {
        update(localId, { state: "failed", message: "网络异常，请重试" });
      }
    },
    [pollCutout, update],
  );

  /** 上传文件（可多张） */
  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;

      const room = MAX_IMAGES - images.length;
      if (room <= 0) {
        toast.error(`最多 ${MAX_IMAGES} 张`);
        return;
      }
      const accepted = list.slice(0, room);
      if (list.length > room) {
        toast.error(`最多 ${MAX_IMAGES} 张，已保留前 ${room} 张`);
      }

      const passed: File[] = [];
      for (const file of accepted) {
        const error = await precheck(file);
        if (error) {
          toast.error(error);
          continue;
        }
        passed.push(file);
      }
      if (passed.length === 0) return;

      // 先插入占位卡片，给用户即时反馈
      const placeholders = passed.map((file) => ({
        localId: makeId(),
        originalKey: "",
        whiteKey: null,
        flatKey: null,
        previewUrl: URL.createObjectURL(file),
        state: "uploading" as const,
      }));
      setImages((prev) => [...prev, ...placeholders]);

      const formData = new FormData();
      passed.forEach((file) => formData.append("files", file));

      try {
        const response = await fetch("/api/wardrobe/upload", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json().catch(() => ({}))) as {
          images?: { key: string; url: string | null }[];
          error?: string;
        };
        if (!response.ok || !data.images) {
          setImages((prev) =>
            prev.filter(
              (image) =>
                !placeholders.some((p) => p.localId === image.localId),
            ),
          );
          toast.error(data.error ?? "上传失败，请重试");
          return;
        }

        // 按顺序回填 key
        setImages((prev) =>
          prev.map((image) => {
            const index = placeholders.findIndex(
              (p) => p.localId === image.localId,
            );
            if (index === -1) return image;
            const uploaded = data.images?.[index];
            if (!uploaded) return image;
            return {
              ...image,
              originalKey: uploaded.key,
              whiteKey: null,
              flatKey: null,
              previewUrl: uploaded.url ?? image.previewUrl,
              state: "ready",
            };
          }),
        );

        // 上传完成后自动逐张去背景（串行，避免触发限流）
        for (let i = 0; i < placeholders.length; i += 1) {
          const uploaded = data.images[i];
          if (!uploaded) continue;
          await startCutout(placeholders[i].localId, uploaded.key);
        }
      } catch {
        toast.error("上传失败，请检查网络");
        setImages((prev) =>
          prev.filter(
            (image) => !placeholders.some((p) => p.localId === image.localId),
          ),
        );
      }
    },
    [images.length, startCutout],
  );

  function removeImage(localId: string) {
    setImages((prev) => prev.filter((image) => image.localId !== localId));
  }

  /** 不再去背景，直接把原图当白底图（用户自己拍的已经是白底） */
  function applyOriginalAsWhite(localId: string) {
    setImages((prev) =>
      prev.map((image) =>
        image.localId === localId
          ? {
              ...image,
              whiteKey: image.originalKey,
              flatKey: image.originalKey,
              state: "done" as const,
              message: "直接使用原图",
            }
          : image,
      ),
    );
  }

  function setCover(localId: string) {
    setImages((prev) => {
      const target = prev.find((image) => image.localId === localId);
      if (!target) return prev;
      return [target, ...prev.filter((image) => image.localId !== localId)];
    });
  }

  const busy = images.some(
    (image) => image.state === "uploading" || image.state === "cutting",
  );

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed p-6 text-center transition-colors",
          dragging ? "border-primary bg-muted/60" : "hover:bg-muted/40",
        )}
      >
        <span className="text-2xl text-muted-foreground">＋</span>
        <span className="text-sm font-medium">点击或拖拽上传照片</span>
        <span className="text-xs text-muted-foreground">
          支持多选，最多 {MAX_IMAGES} 张
        </span>
      </div>

      {/* 去背景能力边界提示：MPS 抠的是「前景主体」，一张图放多件会一起保留 */}
      <div className="space-y-1 text-xs text-muted-foreground">
        <p>一张图只包含一件单品效果会更好哦</p>
        {photoHint ? (
          <p className="text-foreground/70">当前分类：{photoHint}</p>
        ) : null}
      </div>

      {images.length > 0 ? (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <li key={image.localId} className="space-y-1.5">
              <div
                className={cn(
                // 预览优先用白底图，容器用纯白
                "relative aspect-[4/5] overflow-hidden rounded-lg border bg-white",
                  index === 0 && "ring-2 ring-primary",
                )}
              >
                {/* 签名 URL 域名随 COS 桶变化，用原生 img 避免配置 remotePatterns */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.previewUrl}
                  alt={`第 ${index + 1} 张`}
                  className="h-full w-full object-contain"
                />

                {index === 0 ? (
                  <span className="absolute left-1 top-1 rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                    主图
                  </span>
                ) : null}

                {image.state === "uploading" || image.state === "cutting" ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs">
                    {STATE_LABEL[image.state]}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => removeImage(image.localId)}
                  className="absolute right-1 top-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-destructive"
                  aria-label="删除这张图"
                >
                  删除
                </button>
              </div>

              <p
                className={cn(
                  "text-[11px]",
                  image.state === "failed"
                    ? "text-destructive"
                    : "text-muted-foreground",
                )}
              >
                {STATE_LABEL[image.state]}
                {image.message ? `：${image.message}` : ""}
              </p>

              <div className="flex flex-wrap gap-1">
                {image.state === "failed" || image.state === "ready" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-[11px]"
                    disabled={!image.originalKey}
                    onClick={() => void startCutout(image.localId, image.originalKey)}
                  >
                    去背景
                  </Button>
                ) : null}
                {image.state === "failed" && image.originalKey ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => applyOriginalAsWhite(image.localId)}
                  >
                    直接用原图
                  </Button>
                ) : null}
                {index !== 0 && image.state === "done" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[11px]"
                    onClick={() => setCover(image.localId)}
                  >
                    设为主图
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {busy ? (
        <p className="text-xs text-muted-foreground">
          还有 {images.filter((i) => i.state === "uploading" || i.state === "cutting").length} 张图处理中，请稍候…
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
