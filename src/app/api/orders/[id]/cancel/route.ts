import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: { select: { productId: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (order.status === "CANCELLED") {
    return NextResponse.json({ ok: true, status: "CANCELLED" });
  }
  if (order.status !== "PENDING_PAYMENT") {
    return NextResponse.json(
      { error: "只有待支付订单可以取消" },
      { status: 409 },
    );
  }

  const productIds = [
    ...new Set(
      order.items
        .map((item) => item.productId)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: { id, userId, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED" },
    });
    if (updated.count === 0) return false;

    for (const productId of productIds) {
      await tx.product.updateMany({
        where: { id: productId, status: "SOLD" },
        data: { status: "ON_SALE", stock: 1 },
      });
    }
    return true;
  });

  if (!cancelled) {
    const latest = await prisma.order.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (latest?.status === "CANCELLED") {
      return NextResponse.json({ ok: true, status: "CANCELLED" });
    }
    return NextResponse.json(
      { error: "订单状态已变化，请刷新后重试" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status: "CANCELLED" });
}
