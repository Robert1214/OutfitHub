import { z } from "zod";

export const createOrderSchema = z.object({
  addressId: z.string().min(1, "请选择收货地址"),
  idempotencyKey: z.string().min(8, "缺少幂等键").max(100),
});
