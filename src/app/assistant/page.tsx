import { AssistantChat } from "@/components/assistant/assistant-chat";
import { prisma } from "@/lib/db";

export const instant = false;

export const metadata = { title: "导购助手" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const productSlug =
    typeof raw.product === "string" ? raw.product.trim() : "";

  const product = productSlug
    ? await prisma.product.findUnique({
        where: { slug: productSlug },
        select: {
          id: true,
          name: true,
          slug: true,
          color: true,
          category: { select: { name: true } },
          images: {
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { url: true },
          },
        },
      })
    : null;

  const initialProduct = product
    ? {
        id: product.id,
        name: product.name,
        slug: product.slug,
        color: product.color,
        imageUrl: product.images[0]?.url ?? null,
        categoryName: product.category.name,
      }
    : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6">
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          ASSISTANT
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          导购助手
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          找商品、问搭配、看尺码、查政策。演示环境，回答仅作参考。
        </p>
      </div>

      <AssistantChat initialProduct={initialProduct} />
    </div>
  );
}
