import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ids = [
    ...new Set(
      (searchParams.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, 100);

  if (ids.length === 0) {
    return NextResponse.json({ products: [] });
  }

  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      slug: true,
      priceCents: true,
      status: true,
      stock: true,
      color: true,
      sizeLabel: true,
      refType: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true },
      },
      category: { select: { name: true } },
    },
  });

  return NextResponse.json({
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      priceCents: product.priceCents,
      status: product.status,
      stock: product.stock,
      color: product.color,
      sizeLabel: product.sizeLabel,
      refType: product.refType,
      imageUrl: product.images[0]?.url ?? null,
      categoryName: product.category.name,
    })),
  });
}
