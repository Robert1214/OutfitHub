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

  const product = await prisma.product.findUnique({
    where: { id: parsed.data.productId },
    select: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "商品不存在" }, { status: 404 });
  }

  try {
    await prisma.footprint.upsert({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId: product.id,
        },
      },
      update: { viewedAt: new Date() },
      create: {
        userId: session.user.id,
        productId: product.id,
      },
    });
  } catch (error) {
    console.error(
      "记录足迹失败：",
      error instanceof Error ? error.message : "unknown",
    );
    // 足迹失败不影响商品页浏览，不向前端抛错误。
  }

  return NextResponse.json({ ok: true });
}
