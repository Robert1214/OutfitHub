import { z } from "zod";

/**
 * 把 zod 的校验错误拼成一句中文，直接展示给用户。
 * 与旧模块的 formatZodIssues 行为一致，供衣橱模块使用。
 */
export function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => issue.message)
    .filter(Boolean)
    .join("；");
}

export { createItemSchema, updateItemSchema, updateZoneSchema } from "@/lib/validations/wardrobe";
