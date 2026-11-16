import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateItemZone } from "@/lib/wardrobe/items";
import { formatIssues, updateZoneSchema } from "@/lib/wardrobe/validation-helpers";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/items/[id]/zone
 * body: { zone: "WARDROBE" | "LOOK" | "NEW" }
 * New 区「移入衣橱」、加入搭配后用这个接口。
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

  const parsed = updateZoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatIssues(parsed.error) }, { status: 400 });
  }

  const { id } = await params;
  const ok = await updateItemZone(session.user.id, id, parsed.data.zone);
  if (!ok) {
    return NextResponse.json({ error: "单品不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, zone: parsed.data.zone });
}
