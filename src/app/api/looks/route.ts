import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSignedUrlSafe } from "@/lib/cos";
import { createLook, listLooks } from "@/lib/looks";
import { formatIssues } from "@/lib/wardrobe/validation-helpers";
import { createLookSchema } from "@/lib/validations/looks";

/** GET /api/looks?q=&tag=&page= → 搭配列表（含封面签名 URL） */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const tags = searchParams.getAll("tag").map((t) => t.trim()).filter(Boolean);
  const rawPage = Number(searchParams.get("page") ?? "");
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const result = await listLooks(session.user.id, { q, tags, page });

  const looks = await Promise.all(
    result.looks.map(async (look) => ({
      ...look,
      photoUrl: look.photoKey ? await getSignedUrlSafe(look.photoKey) : null,
      collageUrl: look.collageKey
        ? await getSignedUrlSafe(look.collageKey)
        : null,
    })),
  );

  return NextResponse.json({ ...result, looks });
}

/**
 * POST /api/looks
 * body: { name, occasion?, wornAt?, note?, tags[], photoKey?, itemIds[] }
 * → { id, canvas }（canvas 是服务端自动排版的结果）
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

  const parsed = createLookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatIssues(parsed.error) }, { status: 400 });
  }

  const userId = session.user.id;

  // 校验单品都属于当前用户
  const { prisma } = await import("@/lib/db");
  const count = await prisma.wardrobeItem.count({
    where: { id: { in: parsed.data.itemIds }, userId },
  });
  if (count !== parsed.data.itemIds.length) {
    return NextResponse.json({ error: "部分单品不存在" }, { status: 404 });
  }

  try {
    const id = await createLook(userId, parsed.data);
    const look = await prisma.outfit.findUnique({
      where: { id },
      select: { canvas: true },
    });
    return NextResponse.json({ id, canvas: look?.canvas ?? null }, { status: 201 });
  } catch (error) {
    console.error(
      "创建搭配失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "保存失败，请稍后重试" }, { status: 500 });
  }
}
