import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";

export const PRODUCTS_PAGE_SIZE = 12;

export type ProductSort = "newest" | "price_asc" | "price_desc";
export type FitTypeValue = "SLIM" | "REGULAR" | "LOOSE";
export type RefTypeValue = "GARMENT" | "ACCESSORIES" | "SHOES";
export type ProductStatusValue = "DRAFT" | "ON_SALE" | "SOLD" | "ARCHIVED";

export type ProductListParams = {
  q?: string;
  category?: string;
  color?: string;
  fitType?: FitTypeValue;
  minPriceCents?: number;
  maxPriceCents?: number;
  sort?: ProductSort;
  page?: number;
  includeSold?: boolean;
  pageSize?: number;
};

export type ProductListItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  color: string;
  sizeLabel: string | null;
  refType: RefTypeValue;
  fitType: FitTypeValue | null;
  chestCm: number | null;
  lengthCm: number | null;
  shoulderCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  pantsLengthCm: number | null;
  tags: string[];
  stock: number;
  status: ProductStatusValue;
  createdAt: Date;
  category: { name: string; slug: string };
  images: { url: string }[];
};

export type ProductDetail = ProductListItem & {
  material: string | null;
  careInstructions: string | null;
  images: { url: string; sortOrder: number }[];
};

const orderByMap: Record<ProductSort, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  price_asc: { priceCents: "asc" },
  price_desc: { priceCents: "desc" },
};

function buildWhere(params: ProductListParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    status: params.includeSold ? { in: ["ON_SALE", "SOLD"] } : "ON_SALE",
  };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { tags: { has: params.q } },
    ];
  }
  if (params.category) {
    where.category = { slug: params.category };
  }
  if (params.color) {
    where.color = params.color;
  }
  if (params.fitType) {
    where.fitType = params.fitType;
  }

  const priceFilter: Prisma.IntFilter = {};
  if (params.minPriceCents !== undefined) {
    priceFilter.gte = params.minPriceCents;
  }
  if (params.maxPriceCents !== undefined) {
    priceFilter.lte = params.maxPriceCents;
  }
  if (Object.keys(priceFilter).length > 0) {
    where.priceCents = priceFilter;
  }

  return where;
}

export async function getProducts(params: ProductListParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, params.pageSize ?? PRODUCTS_PAGE_SIZE));
  const where = buildWhere(params);

  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: orderByMap[params.sort ?? "newest"],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { name: true, slug: true } },
        images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items satisfies ProductListItem[],
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getRecommendedProducts(limit = 8) {
  const result = await getProducts({ pageSize: limit, sort: "newest" });
  return result.items;
}

export async function getProductSlugs(): Promise<{ slug: string }[]> {
  return prisma.product.findMany({
    where: { status: { in: ["ON_SALE", "SOLD"] } },
    select: { slug: true },
  });
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetail | null> {
  return prisma.product.findFirst({
    where: {
      slug,
      status: { in: ["ON_SALE", "SOLD"] },
    },
    include: {
      category: { select: { name: true, slug: true } },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getCategoriesWithCounts() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: { products: { where: { status: "ON_SALE" } } },
      },
    },
  });
}

export async function getProductColors(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    where: { status: "ON_SALE" },
    select: { color: true },
    distinct: ["color"],
    orderBy: { color: "asc" },
  });
  return rows.map((row) => row.color);
}
