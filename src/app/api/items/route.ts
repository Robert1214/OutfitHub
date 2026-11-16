import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSignedUrlSafe } from "@/lib/cos";
import {
  createItem,
  keysBelongToUser,
  listItems,
} from "@/lib/wardrobe/items";
import { parseItemQuery } from "@/lib/validations/wardrobe";
import {
  createItemSchema,
  formatIssues,
} from "@/lib/wardrobe/validation-helpers";

/**
 * GET /api/items
 * 查询参数：q / category / zone / tag（可多个）/ sort=newest|name / page
 * → { items, total, page, pageSize, totalPages }（含签名 URL）
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = parseItemQuery(searchParams);

  const result = await listItems(session.user.id, query);

  // 批量签名，避免 N 次串行
  const items = await Promise.all(
    result.items.map(async (item) => ({
      ...item,
      coverUrl: await getSignedUrlSafe(item.coverKey),
    })),
  );

  return NextResponse.json({ ...result, items });
}

/**
 * POST /api/items
 * body: { name, category, zone?, brand?, color?, ..., tags: string[], images: [{ whiteKey, originalKey?, sortOrder? }] }
 * → { id }
 */
export async function POST(request: Request) {
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

  const parsed = createItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatIssues(parsed.error) }, { status: 400 });
  }

  const userId = session.user.id;
  const keys = parsed.data.images.flatMap((image) =>
    image.originalKey ? [image.whiteKey, image.originalKey] : [image.whiteKey],
  );
  if (!keysBelongToUser(userId, keys)) {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }

  try {
    const id = await createItem(userId, parsed.data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error(
      "创建单品失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }
}
