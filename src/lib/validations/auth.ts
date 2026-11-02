import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

const email = z
  .string()
  .trim()
  .email("邮箱格式不正确")
  .transform((value) => value.toLowerCase());

const password = z
  .string()
  .min(8, "密码至少 8 位")
  .max(72, "密码不能超过 72 位");

const optionalInt = (label: string, min: number, max: number) =>
  z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int(`${label}必须是整数`)
      .min(min, `${label}不能小于 ${min}`)
      .max(max, `${label}不能大于 ${max}`)
      .optional(),
  );

export const emailLoginSchema = z.object({
  email,
  password: z.string().min(1, "请输入密码"),
});

export const emailRegisterSchema = z.object({
  email,
  password,
  name: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(30, "昵称不能超过 30 个字符").optional(),
  ),
});

export const phoneLoginSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^1\d{10}$/, "请输入 11 位手机号"),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "请输入 6 位验证码"),
});

export const profileSchema = z
  .object({
    name: z.preprocess(
      emptyToUndefined,
      z.string().trim().max(30, "昵称不能超过 30 个字符").optional(),
    ),
    heightCm: optionalInt("身高", 130, 210),
    weightKg: optionalInt("体重", 30, 200),
    bustCm: optionalInt("胸围", 60, 160),
    waistCm: optionalInt("腰围", 40, 140),
    hipCm: optionalInt("臀围", 60, 160),
  })
  .superRefine((data, ctx) => {
    if (
      data.bustCm !== undefined &&
      data.waistCm !== undefined &&
      data.waistCm > data.bustCm
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["waistCm"],
        message: "腰围比胸围还大，是不是填反了？",
      });
    }
    if (
      data.waistCm !== undefined &&
      data.hipCm !== undefined &&
      data.hipCm < data.waistCm
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["hipCm"],
        message: "臀围比腰围还小，是不是填反了？",
      });
    }
  });

export function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => issue.message)
    .filter(Boolean)
    .join("；");
}
