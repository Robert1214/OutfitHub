import { z } from "zod";

const candidateCategory = z.enum(["tops", "bottoms", "dresses", "outerwear", "accessories", "shoes"]);

// Shared wire format for the existing Dify text extractor and code node.
export const assistantRequirementsSchema = z.object({
  q: z.string().trim().max(80),
  intent: z.enum(["search", "outfit", "similar", "product_info", "color_advice", "comparison", "unknown"]),
  category: z.enum(["tops", "bottoms", "dresses", "outerwear", "accessories", "shoes", ""]),
  requestedCategories: z.array(candidateCategory).max(6)
    .refine((values) => new Set(values).size === values.length, "候选品类不能重复").optional(),
  styleTags: z.array(z.string().trim().min(1).max(50)).max(8),
  budgetCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  budgetScope: z.enum(["item", "total", "unknown", "none"]),
  includeCurrentProduct: z.boolean().nullable(),
  anchorProductId: z.string().trim().min(1).max(50).nullable().optional(),
  otherRequirements: z.array(z.string().trim().min(1).max(300)).max(20),
  missingInformation: z.array(z.string().trim().min(1).max(300)).max(20),
}).strict().refine(
  (value) => (value.budgetCents === null) === (value.budgetScope === "none"),
  "预算金额与预算范围不一致",
).refine(
  (value) => value.requestedCategories === undefined ||
    (value.requestedCategories.length === 1
      ? value.category === value.requestedCategories[0]
      : value.category === ""),
  "category 必须与尚待寻找的候选品类一致",
);

export type AssistantRequirements = z.infer<typeof assistantRequirementsSchema>;
