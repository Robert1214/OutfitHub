import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteObject, getSignedUrlSafe } from "@/lib/cos";
import { deleteLook, getLook, updateLook, buildAutoLayout } from "@/lib/looks";
import { formatIssues } from "@/lib/wardrobe/validation-helpers";
import { updateLookSchema } from "@/lib/validations/looks";
import { isCanvasArray } from "@/lib/canvas/types";

type Params = { params: Promise<{ id: string }> };

/** GET /api/looks/[id] → 搭配详情（含签名 URL 与自动排版结果） */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const look = await getLook(session.user.id, id);
  if (!look) {
    return NextResponse.json({ error: "搭配不存在" }, { status: 404 });
  }

  const [photoUrl, collageUrl, items, autoLayout] = await Promise.all([
    look.photoKey ? getSignedUrlSafe(look.photoKey) : null,
    look.collageKey ? getSignedUrlSafe(look.collageKey) : null,
    Promise.all(
      look.items.map(async (item) => ({
        ...item,
        url: await getSignedUrlSafe(item.whiteKey),
      })),
    ),
    buildAutoLayout(
      session.user.id,
      look.items.map((item) => item.id),
    ),
  ]);

  return NextResponse.json({
    ...look,
    photoUrl,
    collageUrl,
    items,
    canvas: isCanvasArray(look.canvas) ? look.canvas : autoLayout,
    autoCanvas: autoLayout,
  });
}

/** PATCH /api/looks/[id] → 编辑信息/标签 */
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

  const parsed = updateLookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatIssues(parsed.error) }, { status: 400 });
  }

  const { id } = await params;
  const ok = await updateLook(session.user.id, id, parsed.data);
  if (!ok) {
    return NextResponse.json({ error: "搭配不存在" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE /api/looks/[id] → 删除搭配并清理 COS（实穿照、拼合图） */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const keys = await deleteLook(session.user.id, id);
  if (!keys) {
    return NextResponse.json({ error: "搭配不存在" }, { status: 404 });
  }

  await Promise.all(keys.map((key) => deleteObject(key).catch(() => undefined)));
  return NextResponse.json({ ok: true });
}
