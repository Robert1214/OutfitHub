/**
 * Look（搭配）服务：所有查询强制带 userId。
 * 画布渲染用到的图片都从单品白底图取，保证与单品一致。
 */
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { getObjectBuffer } from "@/lib/cos";
import { autoLayout } from "@/lib/canvas/layout";
import { isCanvasArray, type CanvasElement, type ItemCategory } from "@/lib/canvas/types";
import type { CreateLookInput, UpdateLookInput } from "@/lib/validations/looks";
import { bumpTagUseCount, resolveTagIds } from "@/lib/wardrobe/tags";

export const LOOKS_PAGE_SIZE = 24;

export type LookSummary = {
  id: string;
  name: string;
  occasion: string | null;
  wornAt: Date | null;
  photoKey: string | null;
  collageKey: string | null;
  createdAt: Date;
  itemCount: number;
  tags: { id: string; name: string }[];
  /** 前几件单品的封面 key（没有实穿照/拼合图时，列表页用它们拼预览） */
  fallbackCoverKeys: string[];
};

export type LookDetail = LookSummary & {
  note: string | null;
  updatedAt: Date;
  canvas: CanvasElement[] | null;
  items: {
    id: string;
    name: string;
    category: ItemCategory;
    coverKey: string;
    /** 透明底 PNG（画布用） */
    whiteKey: string;
    /** 白底 PNG（展示用，可能为空） */
    flatKey: string | null;
  }[];
};

const listSelect = {
  id: true,
  name: true,
  occasion: true,
  wornAt: true,
  photoKey: true,
  collageKey: true,
  createdAt: true,
  tags: { select: { tag: { select: { id: true, name: true } } } },
  _count: { select: { items: true } },
  // 兜底预览：没有实穿照/拼合图时，列表页用前几件单品的封面拼一个示意
  items: {
    orderBy: { sortOrder: "asc" },
    take: 4,
    select: { item: { select: { coverKey: true } } },
  },
} satisfies Prisma.OutfitSelect;

function toSummary(
  row: Prisma.OutfitGetPayload<{ select: typeof listSelect }>,
): LookSummary {
  return {
    id: row.id,
    name: row.name,
    occasion: row.occasion,
    wornAt: row.wornAt,
    photoKey: row.photoKey,
    collageKey: row.collageKey,
    createdAt: row.createdAt,
    itemCount: row._count.items,
    tags: row.tags.map((link) => link.tag),
    fallbackCoverKeys: row.items.map((link) => link.item.coverKey),
  };
}

export type LookListResult = {
  looks: LookSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** 搭配列表：场景标签筛选 + 关键词 */
export async function listLooks(
  userId: string,
  query: { q?: string; tags?: string[]; page?: number } = {},
): Promise<LookListResult> {
  const page = query.page ?? 1;
  const tagFilters = (query.tags ?? []).map((name) => ({
    tags: { some: { tag: { name: { equals: name } } } },
  }));

  const where: Prisma.OutfitWhereInput = {
    userId,
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { occasion: { contains: query.q, mode: "insensitive" } },
            { note: { contains: query.q, mode: "insensitive" } },
            { tags: { some: { tag: { name: { contains: query.q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
    ...(tagFilters.length > 0 ? { AND: tagFilters } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.outfit.findMany({
      where,
      select: listSelect,
      orderBy: [{ wornAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * LOOKS_PAGE_SIZE,
      take: LOOKS_PAGE_SIZE,
    }),
    prisma.outfit.count({ where }),
  ]);

  return {
    looks: rows.map(toSummary),
    total,
    page,
    pageSize: LOOKS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / LOOKS_PAGE_SIZE)),
  };
}

/** 搭配详情（含单品与画布） */
export async function getLook(
  userId: string,
  lookId: string,
): Promise<LookDetail | null> {
  const row = await prisma.outfit.findFirst({
    where: { id: lookId, userId },
    include: {
      tags: { select: { tag: { select: { id: true, name: true } } } },
      _count: { select: { items: true } },
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              coverKey: true,
              images: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { whiteKey: true, flatKey: true },
              },
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
    occasion: row.occasion,
    wornAt: row.wornAt,
    photoKey: row.photoKey,
    collageKey: row.collageKey,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    note: row.note,
    tags: row.tags.map((link) => link.tag),
    itemCount: row._count.items,
    canvas: isCanvasArray(row.canvas) ? row.canvas : null,
    fallbackCoverKeys: row.items.map((link) => link.item.coverKey),
    items: row.items.map((link) => ({
      id: link.item.id,
      name: link.item.name,
      category: link.item.category as ItemCategory,
      coverKey: link.item.coverKey,
      whiteKey: link.item.images[0]?.whiteKey ?? link.item.coverKey,
      flatKey: link.item.images[0]?.flatKey ?? null,
    })),
  };
}

/** 取单品白底图，用于画布渲染 */
async function loadItemImages(
  userId: string,
  itemIds: string[],
): Promise<
  {
    itemId: string;
    name: string;
    category: ItemCategory;
    whiteKey: string;
    aspectRatio: number;
  }[]
> {
  const items = await prisma.wardrobeItem.findMany({
    where: { id: { in: itemIds }, userId },
    select: {
      id: true,
      name: true,
      category: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { whiteKey: true },
      },
    },
  });

  return Promise.all(
    items.map(async (item) => {
      const whiteKey = item.images[0]?.whiteKey ?? "";
      // 读尺寸算宽高比，失败就按 4:5 估
      const buffer = whiteKey ? await getObjectBuffer(whiteKey) : null;
      let aspectRatio = 0.8;
      if (buffer) {
        try {
          const meta = await sharp(buffer).metadata();
          if (meta.width && meta.height) aspectRatio = meta.width / meta.height;
        } catch {
          /* 用默认值 */
        }
      }
      return {
        itemId: item.id,
        name: item.name,
        category: item.category as ItemCategory,
        whiteKey,
        aspectRatio,
      };
    }),
  );
}

/** 为 Look 的单品生成自动排版 */
export async function buildAutoLayout(
  userId: string,
  itemIds: string[],
): Promise<CanvasElement[]> {
  const items = await loadItemImages(userId, itemIds);
  return autoLayout(
    items.map((item) => ({
      itemId: item.itemId,
      imageKey: item.whiteKey,
      category: item.category,
      aspectRatio: item.aspectRatio,
    })),
  );
}

/** 创建 Look */
export async function createLook(
  userId: string,
  input: CreateLookInput,
): Promise<string> {
  const tagIds = await resolveTagIds(userId, input.tags);
  const autoElements = await buildAutoLayout(userId, input.itemIds);

  const lookId = await prisma.$transaction(async (tx) => {
    const created = await tx.outfit.create({
      data: {
        userId,
        name: input.name,
        occasion: input.occasion,
        wornAt: input.wornAt,
        note: input.note,
        photoKey: input.photoKey ?? null,
        canvas: autoElements as unknown as Prisma.InputJsonValue,
        items: {
          create: input.itemIds.map((itemId, index) => ({
            itemId,
            sortOrder: index,
          })),
        },
        tags: { create: tagIds.map((tagId) => ({ tagId })) },
      },
      select: { id: true },
    });
    return created.id;
  });

  await bumpTagUseCount(tagIds, 1);
  return lookId;
}

/** 编辑 Look 信息（不含画布） */
export async function updateLook(
  userId: string,
  lookId: string,
  input: UpdateLookInput,
): Promise<boolean> {
  const existing = await prisma.outfit.findFirst({
    where: { id: lookId, userId },
    select: { id: true, tags: { select: { tagId: true } } },
  });
  if (!existing) return false;

  const oldTagIds = existing.tags.map((link) => link.tagId);
  const nextTagIds =
    input.tags !== undefined ? await resolveTagIds(userId, input.tags) : null;

  await prisma.outfit.update({
    where: { id: lookId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.occasion !== undefined ? { occasion: input.occasion } : {}),
      ...(input.wornAt !== undefined ? { wornAt: input.wornAt } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      ...(input.photoKey !== undefined ? { photoKey: input.photoKey } : {}),
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

  if (nextTagIds) {
    const oldOnly = oldTagIds.filter((id) => !nextTagIds.includes(id));
    const newOnly = nextTagIds.filter((id) => !oldTagIds.includes(id));
    await bumpTagUseCount(oldOnly, -1);
    await bumpTagUseCount(newOnly, 1);
  }

  return true;
}

/** 删除 Look，返回需要清理的 COS key */export async function deleteLook(
  userId: string,
  lookId: string,
): Promise<string[] | null> {
  const existing = await prisma.outfit.findFirst({
    where: { id: lookId, userId },
    select: {
      id: true,
      photoKey: true,
      collageKey: true,
      tags: { select: { tagId: true } },
    },
  });
  if (!existing) return null;

  await prisma.outfit.delete({ where: { id: lookId } });
  await bumpTagUseCount(existing.tags.map((link) => link.tagId), -1);

  return [existing.photoKey, existing.collageKey].filter(
    (key): key is string => Boolean(key),
  );
}
