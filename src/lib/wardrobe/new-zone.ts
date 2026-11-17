/**
 * New 区（新单据）专用查询：
 * - 最近试穿记录（横滑条）
 * - 每件 New 单品是否已被试穿过
 */
import { prisma } from "@/lib/db";
import type { ItemCategoryValue } from "@/lib/validations/wardrobe";

export type RecentTryon = {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  resultKey: string | null;
  createdAt: Date;
  itemCount: number;
  itemNames: string[];
};

/** 最近 N 次试穿（默认 6），按创建时间倒序 */
export async function listRecentTryons(
  userId: string,
  limit = 6,
): Promise<RecentTryon[]> {
  const rows = await prisma.tryonRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 20),
    select: {
      id: true,
      status: true,
      resultKey: true,
      createdAt: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: { item: { select: { name: true } } },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status as RecentTryon["status"],
    resultKey: row.resultKey,
    createdAt: row.createdAt,
    itemCount: row.items.length,
    itemNames: row.items.map((link) => link.item.name),
  }));
}

/** 这批单品里，哪些被成功试穿过（New 区卡片显示「已试穿」） */
export async function getTriedItemIds(
  userId: string,
  itemIds: string[],
): Promise<Set<string>> {
  if (itemIds.length === 0) return new Set();

  const rows = await prisma.tryonRecordItem.findMany({
    where: {
      itemId: { in: itemIds },
      record: { userId, status: "SUCCEEDED" },
    },
    select: { itemId: true },
  });

  return new Set(rows.map((row) => row.itemId));
}

/** New 区卡片状态：待试穿 / 已试穿 */
export type NewItemStatus = "PENDING_TRYON" | "TRIED" | "UNDECIDED";

/**
 * 计算卡片状态（MVP 简化版）：
 * - 试穿过 → TRIED
 * - 没试过 → PENDING_TRYON
 * （PRD 的「待决定」需要额外的决定字段，MVP 暂不区分）
 */
export function resolveNewItemStatus(tried: boolean): NewItemStatus {
  return tried ? "TRIED" : "PENDING_TRYON";
}

export const NEW_STATUS_LABEL: Record<NewItemStatus, string> = {
  PENDING_TRYON: "待试穿",
  TRIED: "已试穿",
  UNDECIDED: "待决定",
};

export type NewZoneCounts = Record<ItemCategoryValue | "ALL", number>;
