"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ImageUploader,
  type UploadedImage,
} from "@/components/wardrobe/image-uploader";
import { TagPicker } from "@/components/wardrobe/tag-picker";
import {
  CATEGORY_LABELS,
  ITEM_CATEGORIES,
  type ItemCategoryValue,
  type ItemZoneValue,
} from "@/lib/validations/wardrobe";
import { cn } from "@/lib/utils";

export type ItemFormValues = {
  id?: string;
  name: string;
  category: ItemCategoryValue;
  zone: ItemZoneValue;
  brand: string;
  color: string;
  material: string;
  sizeLabel: string;
  priceYuan: string;
  purchasedAt: string;
  note: string;
  tags: string[];
  images: UploadedImage[];
};

type Props = {
  initial: ItemFormValues;
  /** 入口来源：决定保存后跳转 */
  mode: "create" | "edit";
};

export function ItemForm({ initial, mode }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState<ItemCategoryValue>(initial.category);
  const [zone, setZone] = useState<ItemZoneValue>(initial.zone);
  const [brand, setBrand] = useState(initial.brand);
  const [color, setColor] = useState(initial.color);
  const [material, setMaterial] = useState(initial.material);
  const [sizeLabel, setSizeLabel] = useState(initial.sizeLabel);
  const [priceYuan, setPriceYuan] = useState(initial.priceYuan);
  const [purchasedAt, setPurchasedAt] = useState(initial.purchasedAt);
  const [note, setNote] = useState(initial.note);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [images, setImages] = useState<UploadedImage[]>(initial.images);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processing = images.filter(
    (image) => image.state === "uploading" || image.state === "cutting",
  ).length;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("请填写名称");
      return;
    }
    if (images.length === 0) {
      setError("至少需要一张图片");
      return;
    }
    if (processing > 0) {
      setError(`还有 ${processing} 张图处理中，请稍候`);
      return;
    }

    const usable = images.filter((image) => image.whiteKey);
    if (usable.length === 0) {
      setError("图片都还没去背景，请为至少一张图去背景或选择直接用原图");
      return;
    }

    const priceNumber = priceYuan.trim() ? Number(priceYuan) : null;
    if (
      priceNumber !== null &&
      (!Number.isFinite(priceNumber) || priceNumber < 0)
    ) {
      setError("价格填写不正确");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      category,
      zone,
      brand: brand.trim() || null,
      color: color.trim() || null,
      material: material.trim() || null,
      sizeLabel: sizeLabel.trim() || null,
      priceCents:
        priceNumber === null ? null : Math.round(priceNumber * 100),
      purchasedAt: purchasedAt ? new Date(purchasedAt) : null,
      note: note.trim() || null,
      tags,
      images: usable.map((image, index) => ({
        whiteKey: image.whiteKey as string,
        flatKey: image.flatKey,
        originalKey:
          image.whiteKey === image.originalKey ? null : image.originalKey,
        sortOrder: index,
      })),
    };

    try {
      const response = await fetch(
        mode === "create" ? "/api/items" : `/api/items/${initial.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "保存失败，请重试");
        setSaving(false);
        return;
      }

      toast.success(mode === "create" ? "单品已添加" : "已保存");
      const targetId = initial.id ?? data.id;
      router.push(targetId ? `/items/${targetId}` : "/wardrobe");
      router.refresh();
    } catch {
      setError("网络异常，请重试");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">照片</h2>
          <span className="text-xs text-muted-foreground">
            第一张为主图
          </span>
        </div>
        <ImageUploader
          initialImages={initial.images}
          onChange={setImages}
          onColorExtracted={(value) => {
            // 颜色为空时才自动填入，避免覆盖用户已选
            setColor((current) => (current.trim() ? current : value));
          }}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium">信息</h2>

        <div className="space-y-1.5">
          <Label htmlFor="item-name">
            名称 <span className="text-destructive">*</span>
          </Label>
          <Input
            id="item-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={40}
            required
            placeholder="如：深蓝牛津衬衫"
          />
        </div>

        <div className="space-y-1.5">
          <Label>
            分类 <span className="text-destructive">*</span>
          </Label>
          <div className="flex flex-wrap gap-2">
            {ITEM_CATEGORIES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  category === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {CATEGORY_LABELS[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>所属区</Label>
          <div className="flex gap-2">
            {(
              [
                ["WARDROBE", "衣橱"],
                ["NEW", "新单据"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setZone(value)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  zone === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="item-brand">品牌</Label>
            <Input
              id="item-brand"
              value={brand}
              onChange={(event) => setBrand(event.target.value)}
              maxLength={30}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-color">颜色</Label>
            <Input
              id="item-color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              maxLength={20}
              placeholder="如 #1B2A4A 或「藏青」"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-material">材质</Label>
            <Input
              id="item-material"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
              maxLength={30}
              placeholder="如 棉、羊毛"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-size">尺码</Label>
            <Input
              id="item-size"
              value={sizeLabel}
              onChange={(event) => setSizeLabel(event.target.value)}
              maxLength={10}
              placeholder="如 M、均码"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-price">价格（元）</Label>
            <Input
              id="item-price"
              value={priceYuan}
              onChange={(event) => setPriceYuan(event.target.value)}
              inputMode="decimal"
              placeholder="选填"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="item-purchased">购买日期</Label>
            <Input
              id="item-purchased"
              type="date"
              value={purchasedAt}
              onChange={(event) => setPurchasedAt(event.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-note">备注</Label>
          <textarea
            id="item-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="选填"
          />
        </div>

        <div className="space-y-1.5">
          <Label>标签</Label>
          <TagPicker value={tags} onChange={setTags} />
        </div>
      </section>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "保存中…" : mode === "create" ? "保存单品" : "保存修改"}
        </Button>
        <Link
          href={initial.id ? `/items/${initial.id}` : "/wardrobe"}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          取消
        </Link>
      </div>
    </form>
  );
}
