import { NextResponse } from "next/server";
import sharp, { type Metadata } from "sharp";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  deletePhotoObject,
  getSignedPhotoUrl,
  isCosConfigured,
  putUserPhoto,
} from "@/lib/cos";

const MAX_BYTES = 8 * 1024 * 1024;
const MIN_DIMENSION = 200;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

function normalizeContentType(format: string): string {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

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
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return NextResponse.json(
      { error: "只支持 JPG / PNG / WebP 格式" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "图片超过 8MB，请换一张" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    return NextResponse.json(
      { error: "图片无法识别，请换一张" },
      { status: 400 },
    );
  }

  const format = metadata.format;
  if (!format || !ALLOWED_FORMATS.has(format)) {
    return NextResponse.json(
      { error: "只支持 JPG / PNG / WebP 格式" },
      { status: 400 },
    );
  }
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < MIN_DIMENSION ||
    metadata.height < MIN_DIMENSION
  ) {
    return NextResponse.json(
      { error: "图片太小，可能看不清主体，请换一张清晰的照片" },
      { status: 400 },
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

  const contentType = normalizeContentType(format);

  let newKey: string;
  try {
    newKey = await putUserPhoto(userId, buffer, contentType);
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
    await deletePhotoObject(newKey).catch(() => undefined);
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
    await deletePhotoObject(user.photoKey).catch((error: unknown) => {
      console.error(
        "删除旧照片失败：",
        error instanceof Error ? error.message : "unknown",
      );
    });
  }

  const url = await getSignedPhotoUrl(newKey);
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
    await deletePhotoObject(user.photoKey);
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
