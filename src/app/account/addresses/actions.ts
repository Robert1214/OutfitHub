"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeNextPath } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { addressSchema } from "@/lib/validations/address";
import { formatZodIssues } from "@/lib/validations/auth";

function getValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function addressPageUrl(
  next: string,
  params: Record<string, string> = {},
): string {
  const search = new URLSearchParams();
  if (next) search.set("next", next);
  for (const [key, value] of Object.entries(params)) {
    search.set(key, value);
  }
  const query = search.toString();
  return `/account/addresses${query ? `?${query}` : ""}`;
}

function parseForm(formData: FormData) {
  return addressSchema.safeParse({
    recipient: formData.get("recipient"),
    phone: formData.get("phone"),
    province: formData.get("province"),
    city: formData.get("city"),
    district: formData.get("district"),
    detail: formData.get("detail"),
    isDefault: formData.get("isDefault"),
  });
}

async function getUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/account/addresses");
  }
  return session.user.id;
}

export async function createAddress(formData: FormData) {
  const userId = await getUserId();
  const next = safeNextPath(getValue(formData, "next"), "");
  const parsed = parseForm(formData);

  if (!parsed.success) {
    redirect(
      addressPageUrl(next, {
        error: formatZodIssues(parsed.error),
      }),
    );
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.address.updateMany({
        where: { userId },
        data: { isDefault: false },
      });
    }
    await tx.address.create({
      data: { ...parsed.data, userId },
    });
  });

  if (next) redirect(next);
  redirect(addressPageUrl("", { success: "created" }));
}

export async function updateAddress(formData: FormData) {
  const userId = await getUserId();
  const next = safeNextPath(getValue(formData, "next"), "");
  const addressId = getValue(formData, "addressId");
  const parsed = parseForm(formData);

  if (!addressId) {
    redirect(addressPageUrl(next, { error: "地址不存在" }));
  }
  if (!parsed.success) {
    redirect(
      addressPageUrl(next, {
        error: formatZodIssues(parsed.error),
      }),
    );
  }

  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true },
  });
  if (!existing) {
    redirect(addressPageUrl(next, { error: "地址不存在" }));
  }

  await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.address.updateMany({
        where: { userId, NOT: { id: addressId } },
        data: { isDefault: false },
      });
    }
    await tx.address.update({
      where: { id: addressId },
      data: parsed.data,
    });
  });

  if (next) redirect(next);
  redirect(addressPageUrl("", { success: "updated" }));
}

export async function deleteAddress(formData: FormData) {
  const userId = await getUserId();
  const next = safeNextPath(getValue(formData, "next"), "");
  const addressId = getValue(formData, "addressId");
  if (!addressId) redirect(addressPageUrl(next, { error: "地址不存在" }));

  await prisma.address.deleteMany({
    where: { id: addressId, userId },
  });

  if (next) redirect(next);
  redirect(addressPageUrl("", { success: "deleted" }));
}

export async function setDefaultAddress(formData: FormData) {
  const userId = await getUserId();
  const next = safeNextPath(getValue(formData, "next"), "");
  const addressId = getValue(formData, "addressId");
  if (!addressId) redirect(addressPageUrl(next, { error: "地址不存在" }));

  const existing = await prisma.address.findFirst({
    where: { id: addressId, userId },
    select: { id: true },
  });
  if (!existing) {
    redirect(addressPageUrl(next, { error: "地址不存在" }));
  }

  await prisma.$transaction(async (tx) => {
    await tx.address.updateMany({
      where: { userId, NOT: { id: addressId } },
      data: { isDefault: false },
    });
    await tx.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    });
  });

  if (next) redirect(next);
  redirect(addressPageUrl("", { success: "default" }));
}
