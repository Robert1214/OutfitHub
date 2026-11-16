import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  deleteObject,
  getSignedUrl,
  isCosConfigured,
  putUserPhoto,
} from "@/lib/cos";
import { ImageValidationError, validateImageFile } from "@/lib/image";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!isCosConfigured()) {
    return NextResponse.json(
      { error: "照片存储暂未配置，请稍后再试" },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "上传格式不正确" }, { status: 400 });
  }

  const file = formData.get("photo");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "请选择一张照片" }, { status: 400 });
  }

  let image;
  try {
    image = await validateImageFile(file);
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(
      "照片校验异常：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "照片处理失败，请重试" }, { status: 500 });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { photoKey: true },
  });
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let newKey: string;
  try {
    // 原图不压缩、不重编码（PRD §3.9：MPS 输入需原图）
    newKey = await putUserPhoto(userId, image.buffer, image.contentType);
  } catch (error) {
    console.error(
      "照片上传 COS 失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "照片上传失败，请稍后重试" },
      { status: 500 },
    );
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { photoKey: newKey },
    });
  } catch (error) {
    await deleteObject(newKey).catch(() => undefined);
    console.error(
      "照片 key 写入失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "照片保存失败，请稍后重试" },
      { status: 500 },
    );
  }

  if (user.photoKey) {
    await deleteObject(user.photoKey).catch((error: unknown) => {
      console.error(
        "删除旧照片失败：",
        error instanceof Error ? error.message : "unknown",
      );
    });
  }

  const url = await getSignedUrl(newKey);
  return NextResponse.json({ url });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!isCosConfigured()) {
    return NextResponse.json(
      { error: "照片存储暂未配置，请稍后再试" },
      { status: 503 },
    );
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { photoKey: true },
  });
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!user.photoKey) {
    return NextResponse.json({ ok: true });
  }

  try {
    await deleteObject(user.photoKey);
  } catch (error) {
    console.error(
      "删除照片 COS 对象失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "删除失败，请稍后重试" },
      { status: 500 },
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { photoKey: null },
  });

  return NextResponse.json({ ok: true });
}
