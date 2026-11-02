import { z } from "zod";

const checkboxToBoolean = (value: unknown) =>
  value === "on" || value === "true" || value === "1" || value === true;

export const addressSchema = z.object({
  recipient: z.string().trim().min(1, "请填写收件人").max(30, "收件人过长"),
  phone: z
    .string()
    .trim()
    .regex(/^1\d{10}$/, "请输入 11 位手机号"),
  province: z.string().trim().min(1, "请填写省份").max(30, "省份过长"),
  city: z.string().trim().min(1, "请填写城市").max(30, "城市过长"),
  district: z.string().trim().min(1, "请填写区/县").max(30, "区/县过长"),
  detail: z.string().trim().min(1, "请填写详细地址").max(120, "详细地址过长"),
  isDefault: z.preprocess(checkboxToBoolean, z.boolean()),
});

export type AddressInput = z.infer<typeof addressSchema>;
