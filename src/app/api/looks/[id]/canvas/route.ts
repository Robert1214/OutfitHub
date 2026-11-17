import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  buildObjectKey,
  COS_PREFIX,
  getObjectBuffer,
  getSignedUrlSafe,
  putObject,
} from "@/lib/cos";
import { prisma } from "@/lib/db";
import { renderCanvas } from "@/lib/canvas/render";
import { clampElement, MAX_ITEMS, type ItemCategory } from "@/lib/canvas/types";
import { formatIssues } from "@/lib/wardrobe/validation-helpers";
import { saveCanvasSchema } from "@/lib/validations/looks";

type Params = { params: Promise<{ id: string }> };

/**
 * PUT /api/looks/[id]/canvas
 * body: { elements: CanvasElement[] }
 * → 保存坐标 → 服务端 sharp 渲染 2000×2000 PNG → 存 COS → { collageKey, collageUrl }
 */
export async function PUT(request: Request, { params }: Params) {
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

  const parsed = saveCanvasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: formatIssues(parsed.error) }, { status: 400 });
  }

  const userId = session.user.id;
  const { id } = await params;

  const look = await prisma.outfit.findFirst({
    where: { id, userId },
    select: {
      id: true,
      items: {
        select: {
          item: {
            select: {
              id: true,
              category: true,
              images: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { whiteKey: true },
              },
            },
          },
        },
      },
    },
  });
  if (!look) {
    return NextResponse.json({ error: "搭配不存在" }, { status: 404 });
  }

  // 元素必须都属于该搭配，防止塞入别人的单品
  const allowed = new Map(
    look.items.map((link) => [
      link.item.id,
      {
        category: link.item.category as ItemCategory,
        whiteKey: link.item.images[0]?.whiteKey ?? "",
      },
    ]),
  );

  const elements = parsed.data.elements
    .filter((element) => allowed.has(element.itemId))
    .map((element) => clampElement(element))
    .slice(0, MAX_ITEMS);

  if (elements.length === 0) {
    return NextResponse.json({ error: "画布上没有有效元素" }, { status: 400 });
  }

  // 取图并渲染
  let png: Buffer;
  try {
    const renderInputs = await Promise.all(
      elements.map(async (element) => {
        const info = allowed.get(element.itemId);
        const buffer = info?.whiteKey
          ? await getObjectBuffer(info.whiteKey)
          : null;
        if (!buffer) throw new Error(`读取图片失败：${element.itemId}`);
        return {
          element,
          category: info?.category ?? ("TOP" as ItemCategory),
          buffer,
        };
      }),
    );
    png = await renderCanvas(renderInputs);
  } catch (error) {
    console.error(
      "渲染拼合图失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "生成拼合图失败，请重试" },
      { status: 500 },
    );
  }

  // 存 COS
  let collageKey: string;
  try {
    const key = buildObjectKey(COS_PREFIX.outfit, userId, "image/png");
    collageKey = await putObject(key, png, "image/png");
  } catch (error) {
    console.error(
      "拼合图上传失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "保存拼合图失败，请稍后重试" },
      { status: 500 },
    );
  }

  const previousKey = await prisma.outfit
    .findUnique({ where: { id }, select: { collageKey: true } })
    .then((row) => row?.collageKey ?? null);

  await prisma.outfit.update({
    where: { id },
    data: {
      canvas: elements,
      collageKey,
    },
  });

  // 旧拼合图不再被引用，删掉（失败不影响主流程）
  if (previousKey && previousKey !== collageKey) {
    const { deleteObject } = await import("@/lib/cos");
    await deleteObject(previousKey).catch(() => undefined);
  }

  const collageUrl = await getSignedUrlSafe(collageKey);
  return NextResponse.json({ ok: true, collageKey, collageUrl });
}
