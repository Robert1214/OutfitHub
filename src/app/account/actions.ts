"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatZodIssues,
  profileSchema,
} from "@/lib/validations/auth";

export type ProfileState = {
  error?: string;
  success?: boolean;
};

export async function updateProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "登录已过期，请重新登录" };
  }

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    heightCm: formData.get("heightCm"),
    weightKg: formData.get("weightKg"),
    bustCm: formData.get("bustCm"),
    waistCm: formData.get("waistCm"),
    hipCm: formData.get("hipCm"),
  });

  if (!parsed.success) {
    return { error: formatZodIssues(parsed.error) };
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        name: parsed.data.name ?? null,
        heightCm: parsed.data.heightCm ?? null,
        weightKg: parsed.data.weightKg ?? null,
        bustCm: parsed.data.bustCm ?? null,
        waistCm: parsed.data.waistCm ?? null,
        hipCm: parsed.data.hipCm ?? null,
      },
    });
  } catch (error) {
    console.error(
      "保存资料失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return { error: "保存失败，请稍后重试" };
  }

  revalidatePath("/account");
  return { success: true };
}
