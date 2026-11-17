import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls, getSignedUrlSafe } from "@/lib/cos";
import { prisma } from "@/lib/db";
import { countTodayTryons } from "@/lib/tryon/run";
import { DAILY_LIMIT, MAX_TRYON_ITEMS } from "@/lib/tryon/types";
import { TryonWorkbench } from "@/components/tryon/tryon-workbench";

export const metadata = { title: "试穿 · OutfitHub" };
export const instant = false;

export default async function TryonPage({
  searchParams,
}: {
  searchParams: Promise<{ itemId?: string }>;
}) {
  const session = await requireUser("/tryon");
  const raw = await searchParams;

  const initialItemIds = (raw.itemId ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_TRYON_ITEMS);

  const [user, items, used] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { photoKey: true },
    }),
    prisma.wardrobeItem.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        name: true,
        category: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { flatKey: true, whiteKey: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    countTodayTryons(session.user.id),
  ]);

  const thumbKeys = items.map(
    (item) => item.images[0]?.flatKey ?? item.images[0]?.whiteKey ?? "",
  );
  const [signed, photoUrl] = await Promise.all([
    getSignedUrls(thumbKeys.filter(Boolean)),
    user?.photoKey ? getSignedUrlSafe(user.photoKey) : null,
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <Link
          href="/wardrobe"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← 返回衣橱
        </Link>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">TRYON</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          试穿
        </h1>
        <p className="text-sm text-muted-foreground">
          选 1~4 件单品，用个人中心的人像生成试穿效果。
        </p>
      </div>

      <TryonWorkbench
        initialItemIds={initialItemIds}
        photoUrl={photoUrl}
        quota={{
          used,
          limit: DAILY_LIMIT,
          remaining: Math.max(0, DAILY_LIMIT - used),
        }}
        items={items.map((item, index) => ({
          id: item.id,
          name: item.name,
          category: item.category as
            | "TOP"
            | "BOTTOM"
            | "SHOES"
            | "ACCESSORY",
          thumbUrl: signed[thumbKeys[index]] ?? null,
        }))}
      />
    </div>
  );
}
