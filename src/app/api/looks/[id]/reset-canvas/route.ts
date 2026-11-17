import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSignedUrlSafe } from "@/lib/cos";
import { buildAutoLayout } from "@/lib/looks";
import { renderCanvas } from "@/lib/canvas/render";
import {
  buildObjectKey,
  COS_PREFIX,
  deleteObject,
  getObjectBuffer,
  putObject,
} from "@/lib/cos";
import { MAX_ITEMS, type ItemCategory } from "@/lib/canvas/types";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/looks/[id]/reset-canvas
 * → 按单品重新自动排版，写入 DB 并重新渲染拼合图
 */
export async function POST(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const userId = session.user.id;
  const { id } = await params;

  const look = await prisma.outfit.findFirst({
    where: { id, userId },
    select: {
      collageKey: true,
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

  const itemIds = look.items.slice(0, MAX_ITEMS).map((link) => link.item.id);
  const autoElements = await buildAutoLayout(userId, itemIds);

  // 重新渲染并覆盖拼合图
  try {
    const categoryByItem = new Map(
      look.items.map((link) => [
        link.item.id,
        {
          category: link.item.category as ItemCategory,
          whiteKey: link.item.images[0]?.whiteKey ?? "",
        },
      ]),
    );

    const inputs = await Promise.all(
      autoElements.map(async (element) => {
        const info = categoryByItem.get(element.itemId);
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

    const png = await renderCanvas(inputs);
    const collageKey = buildObjectKey(COS_PREFIX.outfit, userId, "image/png");
    await putObject(collageKey, png, "image/png");

    await prisma.outfit.update({
      where: { id },
      data: { canvas: autoElements, collageKey },
    });

    if (look.collageKey && look.collageKey !== collageKey) {
      await deleteObject(look.collageKey).catch(() => undefined);
    }

    return NextResponse.json({
      ok: true,
      canvas: autoElements,
      collageKey,
      collageUrl: await getSignedUrlSafe(collageKey),
    });
  } catch (error) {
    console.error(
      "恢复自动排版失败：",
      error instanceof Error ? error.message : "unknown",
    );
    // 渲染失败也要把坐标写回去，至少位置正确
    await prisma.outfit.update({
      where: { id },
      data: { canvas: autoElements },
    });
    return NextResponse.json({ ok: true, canvas: autoElements, collageUrl: null });
  }
}
