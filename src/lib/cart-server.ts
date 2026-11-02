import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export const cartItemInclude = {
  product: {
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
  },
} satisfies Prisma.CartItemInclude;

export type CartItemWithProduct = Prisma.CartItemGetPayload<{
  include: typeof cartItemInclude;
}>;

export type CartItemView = {
  id: string;
  productId: string;
  selected: boolean;
  addedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    status: "DRAFT" | "ON_SALE" | "SOLD" | "ARCHIVED";
    stock: number;
    color: string;
    sizeLabel: string | null;
    refType: "GARMENT" | "ACCESSORIES" | "SHOES";
    imageUrl: string | null;
    categoryName: string;
  };
};

export function toCartItemView(item: CartItemWithProduct): CartItemView {
  return {
    id: item.id,
    productId: item.productId,
    selected: item.selected,
    addedAt: item.addedAt.toISOString(),
    product: {
      id: item.product.id,
      name: item.product.name,
      slug: item.product.slug,
      priceCents: item.product.priceCents,
      status: item.product.status,
      stock: item.product.stock,
      color: item.product.color,
      sizeLabel: item.product.sizeLabel,
      refType: item.product.refType,
      imageUrl: item.product.images[0]?.url ?? null,
      categoryName: item.product.category.name,
    },
  };
}

export async function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function getCartItems(userId: string): Promise<CartItemView[]> {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: cartItemInclude,
        orderBy: { addedAt: "asc" },
      },
    },
  });
  return (cart?.items ?? []).map(toCartItemView);
}
