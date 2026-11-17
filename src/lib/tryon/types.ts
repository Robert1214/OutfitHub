/**
 * 试穿相关类型（服务端专用）。
 * 从旧项目 src/lib/types.ts 抽出来，避免跨项目依赖。
 */

/** 衣橱分类 → MPS ImageSet 的参考图类型 */
export type RefImageType = "garment" | "accessories" | "shoes";

export type TryonConfig = {
  secretId: string;
  secretKey: string;
  cosBucket: string;
  cosRegion: string;
  mpsRegion: string;
};

export function getTryonConfig(): TryonConfig | null {
  const secretId = process.env.TENCENT_SECRET_ID?.trim();
  const secretKey = process.env.TENCENT_SECRET_KEY?.trim();
  const cosBucket = process.env.TENCENT_COS_BUCKET?.trim();
  if (!secretId || !secretKey || !cosBucket) return null;
  return {
    secretId,
    secretKey,
    cosBucket,
    cosRegion: process.env.TENCENT_COS_REGION?.trim() || "ap-guangzhou",
    mpsRegion: process.env.TENCENT_MPS_REGION?.trim() || "ap-guangzhou",
  };
}

/** 衣橱分类 → MPS 参考图类型 */
export const CATEGORY_TO_REF_TYPE: Record<
  "TOP" | "BOTTOM" | "SHOES" | "ACCESSORY",
  RefImageType
> = {
  TOP: "garment",
  BOTTOM: "garment",
  SHOES: "shoes",
  ACCESSORY: "accessories",
};

/** 单次试穿最多几件（MPS ImageSet 实测上限 4） */
export const MAX_TRYON_ITEMS = 4;
export const MIN_TRYON_ITEMS = 1;

/** 每日次数上限（用户定：5 次/天，每次 1 元） */
export const DAILY_LIMIT = Number(process.env.TRYON_DAILY_LIMIT ?? 5);

/** 超时判定（毫秒）：超过这个时间还没结果就标失败 */
export const TRYON_TIMEOUT_MS = 3 * 60 * 1000;
