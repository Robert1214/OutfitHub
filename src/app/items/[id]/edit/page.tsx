import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrlSafe } from "@/lib/cos";
import { getItem } from "@/lib/wardrobe/items";
import { ItemForm } from "@/components/wardrobe/item-form";
import type { UploadedImage } from "@/components/wardrobe/image-uploader";

export const metadata = { title: "编辑单品 · OutfitHub" };
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function EditItemPage({ params }: Props) {
  const session = await requireUser("/items");
  const { id } = await params;
  const item = await getItem(session.user.id, id);
  if (!item) notFound();

  const images: UploadedImage[] = await Promise.all(
    item.images.map(async (image) => ({
      localId: image.id,
      originalKey: image.originalKey ?? image.whiteKey,
      whiteKey: image.whiteKey,
      flatKey: image.flatKey,
      previewUrl:
        (await getSignedUrlSafe(image.flatKey ?? image.whiteKey)) ?? "",
      state: "done" as const,
    })),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <Link
          href={`/items/${item.id}`}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← 返回单品
        </Link>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          EDIT ITEM
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          编辑单品
        </h1>
      </div>

      <ItemForm
        mode="edit"
        initial={{
          id: item.id,
          name: item.name,
          category: item.category,
          zone: item.zone,
          brand: item.brand ?? "",
          color: item.color ?? "",
          material: item.material ?? "",
          sizeLabel: item.sizeLabel ?? "",
          priceYuan:
            item.priceCents === null ? "" : (item.priceCents / 100).toFixed(2),
          purchasedAt: item.purchasedAt
            ? item.purchasedAt.toISOString().slice(0, 10)
            : "",
          note: item.note ?? "",
          tags: item.tags.map((tag) => tag.name),
          images,
        }}
      />
    </div>
  );
}
