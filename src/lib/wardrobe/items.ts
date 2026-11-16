/**
 * 单品服务：所有查询强制带 userId（数据隔离），越权返回 null 由调用方转 404。
 */
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import type {
  CreateItemInput,
  ItemCategoryValue,
  ItemQuery,
  ItemZoneValue,
  UpdateItemInput,
} from "@/lib/validations/wardrobe";
import { bumpTagUseCount, resolveTagIds } from "./tags";

export const ITEMS_PAGE_SIZE = 24;

export type WardrobeItemSummary = {
  id: string;
  name: string;
  category: ItemCategoryValue;
  zone: ItemZoneValue;
  brand: string | null;
  color: string | null;
  coverKey: string;
  createdAt: Date;
  tags: { id: string; name: string }[];
  imageCount: number;
};

export type WardrobeItemDetail = WardrobeItemSummary & {
  material: string | null;
  sizeLabel: string | null;
  priceCents: number | null;
  purchasedAt: Date | null;
  note: string | null;
  updatedAt: Date;
  images: {
    id: string;
    whiteKey: string;
    originalKey: string | null;
    sortOrder: number;
  }[];
  /** 出现在哪些搭配里（单品详情反查） */
  outfits: { id: string; name: string; photoKey: string | null; collageKey: string | null }[];
};

const listSelect = {
  id: true,
  name: true,
  category: true,
  zone: true,
  brand: true,
  color: true,
  coverKey: true,
  createdAt: true,
  tags: { select: { tag: { select: { id: true, name: true } } } },
  _count: { select: { images: true } },
} satisfies Prisma.WardrobeItemSelect;

function toSummary(
  row: Prisma.WardrobeItemGetPayload<{ select: typeof listSelect }>,
): WardrobeItemSummary {
  return {
    id: row.id,
    name: row.name,
    category: row.category as ItemCategoryValue,
    zone: row.zone as ItemZoneValue,
    brand: row.brand,
    color: row.color,
    coverKey: row.coverKey,
    createdAt: row.createdAt,
    tags: row.tags.map((link) => link.tag),
    imageCount: row._count.images,
  };
}

export type ItemListResult = {
  items: WardrobeItemSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** 衣橱列表：分类 + 标签交集 + 关键词 */
export async function listItems(
  userId: string,
  query: ItemQuery = {},
): Promise<ItemListResult> {
  const page = query.page ?? 1;
  const pageSize = ITEMS_PAGE_SIZE;

  // 标签取交集：每个标签都单独 where，AND 组合
  const tagFilters = (query.tags ?? []).map((name) => ({
    tags: { some: { tag: { name: { equals: name } } } },
  }));

  const where: Prisma.WardrobeItemWhereInput = {
    userId,
    ...(query.zone ? { zone: query.zone } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { brand: { contains: query.q, mode: "insensitive" } },
            { color: { contains: query.q, mode: "insensitive" } },
            { material: { contains: query.q, mode: "insensitive" } },
            { note: { contains: query.q, mode: "insensitive" } },
            { tags: { some: { tag: { name: { contains: query.q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
    ...(tagFilters.length > 0 ? { AND: tagFilters } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.wardrobeItem.findMany({
      where,
      select: listSelect,
      orderBy:
        query.sort === "name"
          ? [{ name: "asc" }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.wardrobeItem.count({ where }),
  ]);

  return {
    items: rows.map(toSummary),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** 各分类数量（衣橱 Tab 角标） */
export async function countByCategory(
  userId: string,
  zone: ItemZoneValue = "WARDROBE",
): Promise<Record<ItemCategoryValue | "ALL", number>> {
  const groups = await prisma.wardrobeItem.groupBy({
    by: ["category"],
    where: { userId, zone },
    _count: { _all: true },
  });

  const result: Record<ItemCategoryValue | "ALL", number> = {
    ALL: 0,
    TOP: 0,
    BOTTOM: 0,
    SHOES: 0,
    ACCESSORY: 0,
  };
  for (const group of groups) {
    result[group.category as ItemCategoryValue] = group._count._all;
    result.ALL += group._count._all;
  }
  return result;
}

/** 单品详情（含所属搭配），不属于该用户返回 null */
export async function getItem(
  userId: string,
  itemId: string,
): Promise<WardrobeItemDetail | null> {
  const row = await prisma.wardrobeItem.findFirst({
    where: { id: itemId, userId },
    include: {
      tags: { select: { tag: { select: { id: true, name: true } } } },
      _count: { select: { images: true } },
      images: {
        select: {
          id: true,
          whiteKey: true,
          originalKey: true,
          sortOrder: true,
        },
        orderBy: { sortOrder: "asc" },
      },
      outfitItems: {
        select: {
          outfit: {
            select: {
              id: true,
              name: true,
              photoKey: true,
              collageKey: true,
            },
          },
        },
      },
    },
  });

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    category: row.category as ItemCategoryValue,
    zone: row.zone as ItemZoneValue,
    brand: row.brand,
    color: row.color,
    coverKey: row.coverKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    material: row.material,
    sizeLabel: row.sizeLabel,
    priceCents: row.priceCents,
    purchasedAt: row.purchasedAt,
    note: row.note,
    tags: row.tags.map((link) => link.tag),
    imageCount: row._count.images,
    images: row.images,
    outfits: row.outfitItems.map((link) => link.outfit),
  };
}

/** 创建单品（图 + 标签 + 首次使用计数） */
export async function createItem(
  userId: string,
  input: CreateItemInput,
): Promise<string> {
  const tagIds = await resolveTagIds(userId, input.tags);

  const itemId = await prisma.$transaction(async (tx) => {
    const created = await tx.wardrobeItem.create({
      data: {
        userId,
        zone: input.zone,
        category: input.category,
        name: input.name,
        brand: input.brand,
        color: input.color,
        material: input.material,
        sizeLabel: input.sizeLabel,
        priceCents: input.priceCents,
        purchasedAt: input.purchasedAt,
        note: input.note,
        coverKey:
          input.images.find((image) => image.sortOrder === 0)?.whiteKey ??
          input.images[0].whiteKey,
        images: {
          create: input.images.map((image, index) => ({
            whiteKey: image.whiteKey,
            originalKey: image.originalKey ?? null,
            sortOrder: image.sortOrder ?? index,
          })),
        },
        tags: {
          create: tagIds.map((tagId) => ({ tagId })),
        },
      },
      select: { id: true },
    });
    return created.id;
  });

  await bumpTagUseCount(tagIds, 1);
  return itemId;
}

/** 编辑单品：图数组给定时整体替换（旧图 key 由调用方比对后清理） */
export async function updateItem(
  userId: string,
  itemId: string,
  input: UpdateItemInput,
): Promise<{ previousImageKeys: string[] } | null> {
  const existing = await prisma.wardrobeItem.findFirst({
    where: { id: itemId, userId },
    select: {
      id: true,
      images: { select: { whiteKey: true, originalKey: true } },
      tags: { select: { tagId: true } },
    },
  });
  if (!existing) return null;

  const oldTagIds = existing.tags.map((link) => link.tagId);
  const nextTagIds =
    input.tags !== undefined ? await resolveTagIds(userId, input.tags) : null;

  const previousImageKeys = existing.images.flatMap((image) =>
    image.originalKey ? [image.whiteKey, image.originalKey] : [image.whiteKey],
  );

  await prisma.$transaction(async (tx) => {
    await tx.wardrobeItem.update({
      where: { id: itemId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.zone !== undefined ? { zone: input.zone } : {}),
        ...(input.brand !== undefined ? { brand: input.brand } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.material !== undefined ? { material: input.material } : {}),
        ...(input.sizeLabel !== undefined ? { sizeLabel: input.sizeLabel } : {}),
        ...(input.priceCents !== undefined ? { priceCents: input.priceCents } : {}),
        ...(input.purchasedAt !== undefined
          ? { purchasedAt: input.purchasedAt }
          : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        ...(input.images !== undefined
          ? {
              coverKey:
                input.images.find((image) => image.sortOrder === 0)?.whiteKey ??
                input.images[0].whiteKey,
              images: {
                deleteMany: {},
                create: input.images.map((image, index) => ({
                  whiteKey: image.whiteKey,
                  originalKey: image.originalKey ?? null,
                  sortOrder: image.sortOrder ?? index,
                })),
              },
            }
          : {}),
        ...(nextTagIds
          ? {
              tags: {
                deleteMany: {},
                create: nextTagIds.map((tagId) => ({ tagId })),
              },
            }
          : {}),
      },
    });
  });

  // 标签计数：先减旧，再加新（同名标签不会重复计数）
  if (nextTagIds) {
    const oldOnly = oldTagIds.filter((id) => !nextTagIds.includes(id));
    const newOnly = nextTagIds.filter((id) => !oldTagIds.includes(id));
    await bumpTagUseCount(oldOnly, -1);
    await bumpTagUseCount(newOnly, 1);
  }

  return { previousImageKeys };
}

/** 切换所属区 */
export async function updateItemZone(
  userId: string,
  itemId: string,
  zone: ItemZoneValue,
): Promise<boolean> {
  const result = await prisma.wardrobeItem.updateMany({
    where: { id: itemId, userId },
    data: { zone },
  });
  return result.count > 0;
}

/**
 * 删除单品，返回需要清理的 COS key。
 * 关联的搭配项 / 试穿项随外键级联删除。
 */
export async function deleteItem(
  userId: string,
  itemId: string,
): Promise<string[] | null> {
  const existing = await prisma.wardrobeItem.findFirst({
    where: { id: itemId, userId },
    select: {
      id: true,
      images: { select: { whiteKey: true, originalKey: true } },
      tags: { select: { tagId: true } },
    },
  });
  if (!existing) return null;

  await prisma.wardrobeItem.delete({ where: { id: itemId } });
  await bumpTagUseCount(
    existing.tags.map((link) => link.tagId),
    -1,
  );

  return existing.images.flatMap((image) =>
    image.originalKey ? [image.whiteKey, image.originalKey] : [image.whiteKey],
  );
}

/** 校验一批 key 都属于该用户（创建/编辑时防串号） */
export function keysBelongToUser(userId: string, keys: string[]): boolean {
  const prefix = `wardrobe/${userId}/`;
  return keys.every((key) => key.startsWith(prefix));
}
