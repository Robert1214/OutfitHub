import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth-guards";
import { ItemForm } from "@/components/wardrobe/item-form";
import type { ItemCategoryValue, ItemZoneValue } from "@/lib/validations/wardrobe";

export const metadata = { title: "添加单品 · OutfitHub" };
export const instant = false;

export default async function NewItemPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; zone?: string }>;
}) {
  await requireUser("/items/new");
  const raw = await searchParams;

  const categories: ItemCategoryValue[] = ["TOP", "BOTTOM", "SHOES", "ACCESSORY"];
  const category = categories.includes(raw.category as ItemCategoryValue)
    ? (raw.category as ItemCategoryValue)
    : "TOP";
  const zone: ItemZoneValue = raw.zone === "NEW" ? "NEW" : "WARDROBE";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <Link
          href={zone === "NEW" ? "/new" : "/wardrobe"}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← 返回
        </Link>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          ADD ITEM
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          添加单品
        </h1>
        <p className="text-sm text-muted-foreground">
          上传照片后会自动去背景；也可以直接上传白底图。
        </p>
      </div>

      <ItemForm
        // key 保证每次进入「添加单品」都是全新的表单实例。
        // 不加的话，Next.js 客户端缓存会复用上一次的组件状态，
        // 导致上一件的图片/名称/颜色残留（2026-11-17 用户反馈）。
        key={randomUUID()}
        mode="create"
        initial={{
          name: "",
          category,
          zone,
          brand: "",
          color: "",
          material: "",
          sizeLabel: "",
          priceYuan: "",
          purchasedAt: "",
          note: "",
          tags: [],
          images: [],
        }}
      />
    </div>
  );
}
