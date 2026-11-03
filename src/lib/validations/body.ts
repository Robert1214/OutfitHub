import { z } from "zod";

const nullableInt = (label: string, min: number, max: number) =>
  z
    .number()
    .int(`${label}必须是整数`)
    .min(min, `${label}不能小于 ${min}`)
    .max(max, `${label}不能大于 ${max}`)
    .nullable();

export const bodyMetricsSchema = z
  .object({
    heightCm: nullableInt("身高", 130, 210),
    bustCm: nullableInt("胸围", 60, 160),
    waistCm: nullableInt("腰围", 40, 140),
    hipCm: nullableInt("臀围", 60, 160),
  })
  .superRefine((data, ctx) => {
    if (
      data.bustCm !== null &&
      data.waistCm !== null &&
      data.waistCm > data.bustCm
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["waistCm"],
        message: "腰围比胸围还大，是不是填反了？",
      });
    }
    if (
      data.waistCm !== null &&
      data.hipCm !== null &&
      data.hipCm < data.waistCm
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["hipCm"],
        message: "臀围比腰围还小，是不是填反了？",
      });
    }
  });

export type BodyMetricsInput = z.infer<typeof bodyMetricsSchema>;
