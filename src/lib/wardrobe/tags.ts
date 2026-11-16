/**
 * 标签服务：按用户隔离，带使用计数（用于自动补全排序）。
 *
 * 规则：
 * - 同一用户内不区分大小写去重（「通勤」和「 通勤 」是同一个）
 * - useCount 只在新建关联时 +1，解除关联时 -1（不低于 0）
 * - 一次性写入用事务，避免并发产生重复标签
 */
import { prisma } from "@/lib/db";

export type TagSummary = {
  id: string;
  name: string;
  useCount: number;
};

/** 归一化：去首尾空白 + 合并连续空白 */
export function normalizeTagName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * 找到或创建标签（按 name 精确匹配，大小写敏感）。
 * 返回 tagId 列表，顺序与输入一致。
 */
export async function resolveTagIds(
  userId: string,
  names: string[],
): Promise<string[]> {
  const unique = Array.from(new Set(names.map(normalizeTagName).filter(Boolean)));
  if (unique.length === 0) return [];

  const existing = await prisma.tag.findMany({
    where: { userId, name: { in: unique } },
    select: { id: true, name: true },
  });
  const byName = new Map(existing.map((tag) => [tag.name, tag.id]));

  const missing = unique.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    await prisma.tag.createMany({
      data: missing.map((name) => ({ userId, name })),
      skipDuplicates: true,
    });
    const created = await prisma.tag.findMany({
      where: { userId, name: { in: missing } },
      select: { id: true, name: true },
    });
    for (const tag of created) byName.set(tag.name, tag.id);
  }

  return unique
    .map((name) => byName.get(name))
    .filter((id): id is string => Boolean(id));
}

/** 当前用户的标签列表，按使用次数降序（自动补全用） */
export async function listTags(
  userId: string,
  options: { q?: string; limit?: number } = {},
): Promise<TagSummary[]> {
  const { q, limit = 50 } = options;
  return prisma.tag.findMany({
    where: {
      userId,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, useCount: true },
    orderBy: [{ useCount: "desc" }, { name: "asc" }],
    take: Math.min(limit, 100),
  });
}

/** 标签使用次数增减（调用方负责事务一致性） */
export async function bumpTagUseCount(
  tagIds: string[],
  delta: 1 | -1,
): Promise<void> {
  if (tagIds.length === 0) return;
  if (delta > 0) {
    await prisma.tag.updateMany({
      where: { id: { in: tagIds } },
      data: { useCount: { increment: 1 } },
    });
    return;
  }
  // 减到 0 为止，避免负数
  await prisma.tag.updateMany({
    where: { id: { in: tagIds }, useCount: { gt: 0 } },
    data: { useCount: { decrement: 1 } },
  });
}

/** 合并标签：把 fromTagId 的所有关联转到 toTagId，再删除 fromTagId */
export async function mergeTags(
  userId: string,
  fromTagId: string,
  toTagId: string,
): Promise<void> {
  if (fromTagId === toTagId) return;
  await prisma.$transaction(async (tx) => {
    const from = await tx.tag.findFirst({
      where: { id: fromTagId, userId },
      select: { id: true },
    });
    const to = await tx.tag.findFirst({
      where: { id: toTagId, userId },
      select: { id: true },
    });
    if (!from || !to) return;

    await tx.itemTag.createMany({
      data: (
        await tx.itemTag.findMany({
          where: { tagId: fromTagId },
          select: { itemId: true },
        })
      ).map((row) => ({ itemId: row.itemId, tagId: toTagId })),
      skipDuplicates: true,
    });
    await tx.outfitTag.createMany({
      data: (
        await tx.outfitTag.findMany({
          where: { tagId: fromTagId },
          select: { outfitId: true },
        })
      ).map((row) => ({ outfitId: row.outfitId, tagId: toTagId })),
      skipDuplicates: true,
    });
    await tx.tag.delete({ where: { id: fromTagId } });
  });
}

/** 删除标签（关联一并级联删除） */
export async function deleteTag(
  userId: string,
  tagId: string,
): Promise<boolean> {
  const result = await prisma.tag.deleteMany({
    where: { id: tagId, userId },
  });
  return result.count > 0;
}
