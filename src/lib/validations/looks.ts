import { z } from "zod";
import { MAX_ITEMS, MIN_ITEMS } from "@/lib/canvas/types";

/** Look 的 COS key（实穿照 / 拼合图） */
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

export const canvasElementSchema = z.object({
  itemId: z.string().min(1),
  imageKey: z.string().min(1),
  x: z.number().min(-0.1).max(1.1),
  y: z.number().min(-0.1).max(1.1),
  scale: z.number().min(0.05).max(5),
  rotation: z.number().min(-360).max(360),
  zIndex: z.number().int().min(0).max(999),
});

export const createLookSchema = z.object({
  name: z.string({ error: "请填写搭配名称" }).trim().min(1, "请填写搭配名称").max(40, "名称最多 40 字"),
  occasion: optionalText("场景", 20),
  wornAt: z.coerce.date().optional().nullable(),
  note: optionalText("备注", 500),
  photoKey: cosKeySchema.optional().nullable(),
  itemIds: z
    .array(z.string().min(1))
    .min(MIN_ITEMS, `至少选 ${MIN_ITEMS} 件单品`)
    .max(MAX_ITEMS, `最多选 ${MAX_ITEMS} 件单品`),
  tags: z.array(z.string().trim().min(1).max(12)).max(8).default([]),
});

export const updateLookSchema = z.object({
  name: z.string().trim().min(1, "请填写搭配名称").max(40, "名称最多 40 字").optional(),
  occasion: optionalText("场景", 20),
  wornAt: z.coerce.date().optional().nullable(),
  note: optionalText("备注", 500),
  photoKey: cosKeySchema.optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(12)).max(8).optional(),
});

export const saveCanvasSchema = z.object({
  elements: z
    .array(canvasElementSchema)
    .min(1, "画布上没有元素")
    .max(MAX_ITEMS, `最多 ${MAX_ITEMS} 件`),
});

export type CreateLookInput = z.infer<typeof createLookSchema>;
export type UpdateLookInput = z.infer<typeof updateLookSchema>;
