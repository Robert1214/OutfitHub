import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listTags } from "@/lib/wardrobe/tags";

/**
 * GET /api/tags?q=&limit=
 * → { tags: [{ id, name, useCount }] }，按使用次数降序（自动补全用）
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() || undefined;
  const rawLimit = Number(searchParams.get("limit") ?? "");
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

  const tags = await listTags(session.user.id, { q, limit });
  return NextResponse.json({ tags });
}
