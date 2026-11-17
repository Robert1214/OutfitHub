import { z } from "zod";

/** 标签：2~12 字，去首尾空白；同一用户内不区分大小写去重（由 service 处理） */
export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "标签不能为空")
  .max(12, "标签最多 12 个字");

export const tagNamesSchema = z
  .array(tagNameSchema)
  .max(8, "一件单品最多 8 个标签")
  .default([]);

export const ITEM_CATEGORIES = ["TOP", "BOTTOM", "SHOES", "ACCESSORY"] as const;
export const ITEM_ZONES = ["WARDROBE", "LOOK", "NEW"] as const;

export type ItemCategoryValue = (typeof ITEM_CATEGORIES)[number];
export type ItemZoneValue = (typeof ITEM_ZONES)[number];

export const CATEGORY_LABELS: Record<ItemCategoryValue, string> = {
  TOP: "上装",
  BOTTOM: "下装",
  SHOES: "鞋子",
  ACCESSORY: "配饰",
};

export const ZONE_LABELS: Record<ItemZoneValue, string> = {
  WARDROBE: "衣橱",
  LOOK: "搭配",
  NEW: "新单据",
};

/**
 * 按分类的拍摄提示（2026-11-18 用户确认）：
 * 参考图越干净，去背景和 AI 试穿越准。
 * 尤其下装：穿在模特身上拍，试穿时会「多出一个人」。
 */
export const CATEGORY_PHOTO_HINTS: Record<ItemCategoryValue, string> = {
  TOP: "平铺拍摄，只拍这一件，不要穿在身上",
  BOTTOM: "平铺或挂拍，不要穿着拍（穿着拍会导致试穿多出一个人）",
  SHOES: "只拍鞋，不要带腿和脚踝",
  ACCESSORY: "单独拍，不要带模特的脸和手",
};

/** COS key：路径形态 `prefix/id/uuid.ext`，避免前端塞入奇怪字符 */
const cosKeySchema = z
  .string({ error: "图片标识不合法" })
  .trim()
  .max(200, "图片标识过长")
  .regex(/^[\w-]+\/[\w-]+\/[\w-]+\.(jpg|jpeg|png|webp)$/i, "图片标识不合法");

const optionalText = (label: string, max: number) =>
  z
    .string({ error: `${label}格式不正确` })
    .trim()
    .max(max, `${label}最多 ${max} 字`)
    .optional()
    .nullable()
    .transform((value) => (value === "" ? null : (value ?? null)));

const optionalInt = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label}必须是数字` })
    .int(`${label}必须是整数`)
    .min(min, `${label}不能小于 ${min}`)
    .max(max, `${label}不能大于 ${max}`)
    .optional()
    .nullable();

/** 主色：#RRGGBB */
export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#([0-9a-fA-F]{6})$/, "颜色格式应为 #RRGGBB");

export const itemImageSchema = z.object({
  /** 去背景后的透明 PNG key（必填；画布叠图、试穿用） */
  whiteKey: cosKeySchema,
  /** 白底 PNG key（列表/详情展示用；缺省时用 whiteKey 展示） */
  flatKey: cosKeySchema.optional().nullable(),
  /** 原图 key（走「直接上传白底图」时为 null） */
  originalKey: cosKeySchema.optional().nullable(),
  sortOrder: z.number().int().min(0).max(20).default(0),
});

export type ItemImageInput = z.infer<typeof itemImageSchema>;

export const createItemSchema = z.object({
  name: z
    .string({ error: "请填写名称" })
    .trim()
    .min(1, "请填写名称")
    .max(40, "名称最多 40 字"),
  category: z.enum(ITEM_CATEGORIES, { error: "请选择分类" }),
  zone: z.enum(ITEM_ZONES, { error: "请选择所属区" }).default("WARDROBE"),
  brand: optionalText("品牌", 30),
  color: optionalText("颜色", 20),
  material: optionalText("材质", 30),
  sizeLabel: optionalText("尺码", 10),
  priceCents: optionalInt("价格", 0, 10_000_000),
  purchasedAt: z.coerce.date().optional().nullable(),
  note: optionalText("备注", 500),
  tags: tagNamesSchema,
  images: z
    .array(itemImageSchema)
    .min(1, "至少需要一张白底图")
    .max(9, "最多 9 张图"),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

/** 编辑：所有字段可选，但给定时必须合法 */
export const updateItemSchema = createItemSchema
  .partial()
  .omit({ images: true })
  .extend({
    images: z
      .array(itemImageSchema)
      .min(1, "至少需要一张白底图")
      .max(9, "最多 9 张图")
      .optional(),
  });

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

/** 切换所属区 */
export const updateZoneSchema = z.object({
  zone: z.enum(ITEM_ZONES, { message: "所属区不正确" }),
});

/** 衣橱列表查询（URL 参数解析，空串视为未填） */
export const itemQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.enum(ITEM_CATEGORIES).optional(),
  zone: z.enum(ITEM_ZONES).optional(),
  /** 多值标签，取交集 */
  tags: z.array(z.string().trim().min(1)).max(8).optional(),
  sort: z.enum(["newest", "name"]).optional(),
  page: z.number().int().positive().max(1000).optional(),
});

export type ItemQuery = z.infer<typeof itemQuerySchema>;

/** 从 URLSearchParams 解析单品列表参数（非法值忽略，不报错） */
export function parseItemQuery(
  searchParams: URLSearchParams,
): ItemQuery {
  const one = (key: string) => {
    const value = searchParams.get(key)?.trim();
    return value ? value : undefined;
  };
  const many = (key: string) =>
    searchParams
      .getAll(key)
      .map((value) => value.trim())
      .filter(Boolean);

  const category = one("category");
  const zone = one("zone");
  const sort = one("sort");
  const page = Number(one("page") ?? "");

  return {
    q: one("q"),
    category: (ITEM_CATEGORIES as readonly string[]).includes(category ?? "")
      ? (category as ItemCategoryValue)
      : undefined,
    zone: (ITEM_ZONES as readonly string[]).includes(zone ?? "")
      ? (zone as ItemZoneValue)
      : undefined,
    tags: many("tag").length > 0 ? many("tag").slice(0, 8) : undefined,
    sort: sort === "name" || sort === "newest" ? sort : undefined,
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 1000) : undefined,
  };
}
