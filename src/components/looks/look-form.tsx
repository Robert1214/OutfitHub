"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagPicker } from "@/components/wardrobe/tag-picker";
import { CATEGORY_LABELS, type ItemCategoryValue } from "@/lib/validations/wardrobe";
import { MAX_ITEMS, MIN_ITEMS } from "@/lib/canvas/types";
import { cn } from "@/lib/utils";

export type SelectableItem = {
  id: string;
  name: string;
  category: ItemCategoryValue;
  coverUrl: string | null;
};

type Props = {
  items: SelectableItem[];
  /** 从衣橱多选带过来的 itemId */
  initialItemIds: string[];
};

export function LookForm({ items, initialItemIds }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [occasion, setOccasion] = useState("");
  const [wornAt, setWornAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>(
    initialItemIds.filter((id) => items.some((item) => item.id === id)),
  );
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<ItemCategoryValue, SelectableItem[]>();
    for (const item of items) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [items]);

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

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      formData.append("purpose", "outfit-photo");
      const response = await fetch("/api/wardrobe/upload", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json().catch(() => ({}))) as {
        images?: { key: string; url: string | null }[];
        error?: string;
      };
      if (!response.ok || !data.images?.[0]) {
        toast.error(data.error ?? "上传失败");
        return;
      }
      setPhotoKey(data.images[0].key);
      setPhotoUrl(data.images[0].url);
    } catch {
      toast.error("网络异常，请重试");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("请填写搭配名称");
      return;
    }
    if (selected.length < MIN_ITEMS) {
      setError(`至少选 ${MIN_ITEMS} 件单品`);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/looks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          occasion: occasion.trim() || null,
          wornAt: wornAt ? new Date(wornAt) : null,
          note: note.trim() || null,
          photoKey,
          itemIds: selected,
          tags,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!response.ok || !data.id) {
        setError(data.error ?? "保存失败，请重试");
        setSaving(false);
        return;
      }

      toast.success("已创建，进入画布排版");
      router.push(`/looks/${data.id}/edit`);
      router.refresh();
    } catch {
      setError("网络异常，请重试");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* 实穿照 */}
      <section className="space-y-3">
        <h2 className="text-sm font-medium">实穿照</h2>
        <div className="flex flex-wrap items-start gap-4">
          <div className="relative h-40 w-32 overflow-hidden rounded-lg border bg-muted">
            {photoUrl ? (
              // 签名 URL 域名随 COS 桶变化
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="实穿照"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
                <span className="text-xl">＋</span>
                <span>未上传</span>
              </div>
            )}
            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-xs">
                上传中…
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={photoUrl ? "outline" : "default"}
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {photoUrl ? "更换照片" : "上传实穿照"}
              </Button>
              {photoUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setPhotoKey(null);
                    setPhotoUrl(null);
                  }}
                >
                  删除
                </Button>
              ) : null}
            </div>
            <p className="max-w-xs text-xs leading-5 text-muted-foreground">
              选填。列表页默认显示这张，悬停时切换成白底拼合图。
            </p>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            void handlePhoto(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </section>

      {/* 基本信息 */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium">基本信息</h2>

        <div className="space-y-1.5">
          <Label htmlFor="look-name">
            搭配名称 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="look-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            required
            placeholder="如：周一通勤"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="look-occasion">场景</Label>
            <Input
              id="look-occasion"
              value={occasion}
              onChange={(event) => setOccasion(event.target.value)}
              maxLength={20}
              placeholder="上班 / 约会 / 旅行…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="look-worn-at">穿着日期</Label>
            <Input
              id="look-worn-at"
              type="date"
              value={wornAt}
              onChange={(event) => setWornAt(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>场景标签</Label>
          <TagPicker value={tags} onChange={setTags} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="look-note">备注</Label>
          <textarea
            id="look-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="选填"
          />
        </div>
      </section>

      {/* 选单品 */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">
            选单品 <span className="text-destructive">*</span>
          </h2>
          <span
            className={cn(
              "text-xs",
              selected.length < MIN_ITEMS
                ? "text-muted-foreground"
                : "text-foreground",
            )}
          >
            已选 {selected.length} / {MAX_ITEMS}
          </span>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            衣橱还没有单品，先去添加
          </p>
        ) : (
          <div className="space-y-4">
            {[...grouped.entries()].map(([category, list]) => (
              <div key={category} className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {CATEGORY_LABELS[category]}
                </p>
                <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                  {list.map((item) => {
                    const index = selected.indexOf(item.id);
                    const active = index !== -1;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          className={cn(
                            "group block w-full overflow-hidden rounded-lg border transition-colors",
                            active ? "ring-2 ring-primary" : "hover:bg-muted/50",
                          )}
                        >
                          <div className="relative aspect-[4/5] bg-[repeating-conic-gradient(#f2f2f2_0%_25%,#fff_0%_50%)] bg-[length:14px_14px]">
                            {item.coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.coverUrl}
                                alt={item.name}
                                className="h-full w-full object-contain"
                              />
                            ) : null}
                            {active ? (
                              <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                                {index + 1}
                              </span>
                            ) : null}
                          </div>
                          <p className="line-clamp-1 px-1 py-1 text-[11px]">
                            {item.name}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving || uploading}>
          {saving ? "创建中…" : "创建并排版"}
        </Button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          取消
        </button>
      </div>
    </form>
  );
}
