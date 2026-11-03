import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

const bodySchema = z.object({
  productId: z.string().min(1),
});

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

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }

  const userId = session.user.id;
  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "商品不存在" }, { status: 404 });
  }

  try {
    const existing = await prisma.favorite.findUnique({
      where: {
        userId_productId: { userId, productId: product.id },
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.favorite.delete({ where: { id: existing.id } });
      return NextResponse.json({ favorited: false });
    }

    await prisma.favorite.create({
      data: { userId, productId: product.id },
    });
    return NextResponse.json({ favorited: true });
  } catch (error) {
    console.error(
      "收藏操作失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "操作失败，请稍后重试" },
      { status: 500 },
    );
  }
}
