import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrlSafe } from "@/lib/cos";
import { formatDateTime, formatPrice } from "@/lib/format";
import { getItem } from "@/lib/wardrobe/items";
import { CATEGORY_LABELS, ZONE_LABELS } from "@/lib/validations/wardrobe";
import { CategoryBadge, ItemActions } from "@/components/wardrobe/item-actions";
import { ItemGallery } from "@/components/wardrobe/item-gallery";
import { Badge } from "@/components/ui/badge";

export const instant = false;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const session = await requireUser("/items");
  const { id } = await params;
  const item = await getItem(session.user.id, id);
  return { title: item ? `${item.name} · OutfitHub` : "单品 · OutfitHub" };
}

export default async function ItemDetailPage({ params }: Props) {
  const session = await requireUser("/items");
  const { id } = await params;
  const item = await getItem(session.user.id, id);
  if (!item) notFound();

  const [images, outfits] = await Promise.all([
    Promise.all(
      item.images.map(async (image) => ({
        ...image,
        url: await getSignedUrlSafe(image.whiteKey),
        originalUrl: image.originalKey
          ? await getSignedUrlSafe(image.originalKey)
          : null,
      })),
    ),
    Promise.all(
      item.outfits.map(async (outfit) => ({
        ...outfit,
        photoUrl: outfit.photoKey ? await getSignedUrlSafe(outfit.photoKey) : null,
        collageUrl: outfit.collageKey
          ? await getSignedUrlSafe(outfit.collageKey)
          : null,
      })),
    ),
  ]);

  const rows: { label: string; value: string }[] = [
    { label: "分类", value: CATEGORY_LABELS[item.category] },
    { label: "所属区", value: ZONE_LABELS[item.zone] },
    { label: "品牌", value: item.brand ?? "—" },
    { label: "颜色", value: item.color ?? "—" },
    { label: "材质", value: item.material ?? "—" },
    { label: "尺码", value: item.sizeLabel ?? "—" },
    { label: "价格", value: item.priceCents === null ? "—" : formatPrice(item.priceCents) },
    {
      label: "购买日期",
      value: item.purchasedAt ? formatDateTime(item.purchasedAt).slice(0, 10) : "—",
    },
    { label: "备注", value: item.note ?? "—" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/wardrobe"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← 返回衣橱
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-2">
        <ItemGallery images={images} name={item.name} />

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge label={CATEGORY_LABELS[item.category]} />
              {item.zone !== "WARDROBE" ? (
                <Badge variant="secondary">{ZONE_LABELS[item.zone]}</Badge>
              ) : null}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {item.name}
            </h1>
            <p className="text-xs text-muted-foreground">
              收录于 {formatDateTime(item.createdAt)}
            </p>
          </div>

          {item.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/wardrobe?tag=${encodeURIComponent(tag.name)}`}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}

          <ItemActions item={{ id: item.id, name: item.name }} />

          <dl className="divide-y rounded-xl border">
            {rows.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-4 px-4 py-3 text-sm"
              >
                <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
                <dd className="min-w-0 text-right break-words">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <section className="mt-12 space-y-4">
        <h2 className="text-sm font-medium">出现在这些搭配里</h2>
        {outfits.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            还没有加入任何搭配
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {outfits.map((outfit) => (
              <li key={outfit.id}>
                <Link href={`/looks/${outfit.id}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-xl border bg-muted">
                    {outfit.photoUrl || outfit.collageUrl ? (
                      // 签名 URL 域名随 COS 桶变化
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={outfit.photoUrl ?? outfit.collageUrl ?? ""}
                        alt={outfit.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                        暂无图片
                      </div>
                    )}
                  </div>
                  <p className="mt-2 truncate text-sm">{outfit.name}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
