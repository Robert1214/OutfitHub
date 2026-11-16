import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  COS_PREFIX,
  buildObjectKey,
  deleteObject,
  getSignedUrls,
  isCosConfigured,
  putObject,
} from "@/lib/cos";
import {
  IMAGE_LIMITS,
  ImageValidationError,
  validateImageFile,
} from "@/lib/image";
import { allowRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/wardrobe/upload
 * 多图上传（field 名 `files`，可多张）→ 校验 → 存 COS → 返回 key 列表。
 *
 * 返回：{ images: [{ key, url, width, height, contentType }] }
 * key 交给后续 /api/items 创建单品时提交；url 是 30 分钟签名链接，仅供预览。
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!isCosConfigured()) {
    return NextResponse.json(
      { error: "图片存储暂未配置，请稍后再试" },
      { status: 503 },
    );
  }

  const userId = session.user.id;

  // 上传接口防刷：每分钟最多 20 次（每次可含多张）
  if (!allowRateLimit(`wardrobe-upload:${userId}`, 20, 60_000)) {
    return NextResponse.json(
      { error: "上传太频繁了，请稍等一下" },
      { status: 429 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "上传格式不正确" }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);
  if (files.length === 0) {
    return NextResponse.json({ error: "请选择至少一张图片" }, { status: 400 });
  }
  if (files.length > IMAGE_LIMITS.maxFilesPerRequest) {
    return NextResponse.json(
      { error: `一次最多上传 ${IMAGE_LIMITS.maxFilesPerRequest} 张` },
      { status: 400 },
    );
  }

  // 先全部校验，避免“传了一半失败”留下孤儿文件
  let validated;
  try {
    validated = await Promise.all(files.map((file) => validateImageFile(file)));
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error(
      "图片校验异常：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "图片处理失败，请重试" }, { status: 500 });
  }

  const uploadedKeys: string[] = [];
  const images: {
    key: string;
    url: string | null;
    width: number;
    height: number;
    contentType: string;
  }[] = [];

  for (const image of validated) {
    const key = buildObjectKey(COS_PREFIX.wardrobe, userId, image.contentType);
    try {
      await putObject(key, image.buffer, image.contentType);
    } catch (error) {
      console.error(
        "单品图上传 COS 失败：",
        error instanceof Error ? error.message : "unknown",
      );
      // 回滚本次已上传的对象，避免产生无人引用的文件
      await Promise.all(
        uploadedKeys.map((uploaded) => deleteObject(uploaded).catch(() => undefined)),
      );
      return NextResponse.json(
        { error: "图片上传失败，请稍后重试" },
        { status: 500 },
      );
    }
    uploadedKeys.push(key);
    images.push({
      key,
      url: null,
      width: image.width,
      height: image.height,
      contentType: image.contentType,
    });
  }

  const signed = await getSignedUrls(uploadedKeys);
  for (const image of images) {
    image.url = signed[image.key] ?? null;
  }

  return NextResponse.json({ images });
}
