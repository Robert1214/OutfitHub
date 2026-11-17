import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteObject, getSignedUrlSafe } from "@/lib/cos";
import {
  deleteItem,
  getItem,
  keysBelongToUser,
  updateItem,
} from "@/lib/wardrobe/items";
import {
  formatIssues,
  updateItemSchema,
} from "@/lib/wardrobe/validation-helpers";

type Params = { params: Promise<{ id: string }> };

/** GET /api/items/[id] → 单品详情（含所属搭配、签名 URL）；不属于当前用户 404 */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const item = await getItem(session.user.id, id);
  if (!item) {
    return NextResponse.json({ error: "单品不存在" }, { status: 404 });
  }

  const [images, outfits] = await Promise.all([
    Promise.all(
      item.images.map(async (image) => ({
        ...image,
        // 展示用白底版；没有时回落到透明版
        url: await getSignedUrlSafe(image.flatKey ?? image.whiteKey),
        originalUrl: image.originalKey
          ? await getSignedUrlSafe(image.originalKey)
          : null,
      })),
    ),
    Promise.all(
      item.outfits.map(async (outfit) => ({
        ...outfit,
        photoUrl: outfit.photoKey
          ? await getSignedUrlSafe(outfit.photoKey)
          : null,
        collageUrl: outfit.collageKey
          ? await getSignedUrlSafe(outfit.collageKey)
          : null,
      })),
    ),
  ]);

  return NextResponse.json({
    ...item,
    images,
    outfits,
    coverUrl: await getSignedUrlSafe(item.coverKey),
  });
}

/**
 * PATCH /api/items/[id]
 * 所有字段可选；images 给定时整体替换，旧图自动清理 COS。
 */
export async function PATCH(request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatIssues(parsed.error) }, { status: 400 });
  }

  const userId = session.user.id;
  const { id } = await params;

  if (parsed.data.images) {
    const keys = parsed.data.images.flatMap((image) =>
      image.originalKey ? [image.whiteKey, image.originalKey] : [image.whiteKey],
    );
    if (!keysBelongToUser(userId, keys)) {
      return NextResponse.json({ error: "图片不存在" }, { status: 404 });
    }
  }

  let result;
  try {
    result = await updateItem(userId, id, parsed.data);
  } catch (error) {
    console.error(
      "更新单品失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }

  if (!result) {
    return NextResponse.json({ error: "单品不存在" }, { status: 404 });
  }

  // 图片被替换时，清理不再被引用的旧图（保留新数组里仍出现的 key）
  if (parsed.data.images) {
    const keep = new Set(
      parsed.data.images.flatMap((image) =>
        image.originalKey
          ? [image.whiteKey, image.originalKey]
          : [image.whiteKey],
      ),
    );
    const stale = result.previousImageKeys.filter((key) => !keep.has(key));
    await Promise.all(stale.map((key) => deleteObject(key).catch(() => undefined)));
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/items/[id] → 删除单品并清理 COS 图片 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  let keys: string[] | null;
  try {
    keys = await deleteItem(session.user.id, id);
  } catch (error) {
    console.error(
      "删除单品失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "删除失败，请稍后重试" }, { status: 500 });
  }

  if (!keys) {
    return NextResponse.json({ error: "单品不存在" }, { status: 404 });
  }

  await Promise.all(keys.map((key) => deleteObject(key).catch(() => undefined)));
  return NextResponse.json({ ok: true });
}
