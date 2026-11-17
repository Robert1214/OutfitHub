import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls } from "@/lib/cos";
import { prisma } from "@/lib/db";
import { LookForm } from "@/components/looks/look-form";
import { MAX_ITEMS } from "@/lib/canvas/types";
import type { ItemCategoryValue } from "@/lib/validations/wardrobe";

export const metadata = { title: "新建搭配 · OutfitHub" };
export const instant = false;

export default async function NewLookPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string }>;
}) {
  const session = await requireUser("/looks/new");
  const raw = await searchParams;

  const initialItemIds = (raw.items ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);

  const items = await prisma.wardrobeItem.findMany({
    where: { userId: session.user.id, zone: { in: ["WARDROBE", "NEW"] } },
    select: {
      id: true,
      name: true,
      category: true,
      coverKey: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const signed = await getSignedUrls(items.map((item) => item.coverKey));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <Link
          href="/wardrobe"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← 返回衣橱
        </Link>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          NEW LOOK
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          新建搭配
        </h1>
        <p className="text-sm text-muted-foreground">
          选 2~8 件单品，创建后进入画布自由排版。
        </p>
      </div>

      <LookForm
        initialItemIds={initialItemIds}
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category as ItemCategoryValue,
          coverUrl: signed[item.coverKey] ?? null,
        }))}
      />
    </div>
  );
}
