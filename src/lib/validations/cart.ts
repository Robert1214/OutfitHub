import { z } from "zod";

export const cartActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("add"),
    productId: z.string().min(1),
  }),
  z.object({
    action: z.literal("remove"),
    productId: z.string().min(1),
  }),
  z.object({
    action: z.literal("select"),
    productId: z.string().min(1),
    selected: z.boolean(),
  }),
  z.object({
    action: z.literal("selectAll"),
    selected: z.boolean(),
  }),
  z.object({
    action: z.literal("merge"),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          selected: z.boolean().optional(),
        }),
      )
      .max(100),
  }),
]);

export type CartAction = z.infer<typeof cartActionSchema>;
