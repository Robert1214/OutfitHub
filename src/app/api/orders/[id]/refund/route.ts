import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REFUNDABLE_STATUSES } from "@/lib/orders";

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
  if (order.status === "REFUNDED") {
    return NextResponse.json({ ok: true, status: "REFUNDED" });
  }
  if (!REFUNDABLE_STATUSES.includes(order.status)) {
    return NextResponse.json(
      { error: "当前订单状态不能退款" },
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

  const refunded = await prisma.$transaction(async (tx) => {
    const updated = await tx.order.updateMany({
      where: {
        id,
        userId,
        status: { in: REFUNDABLE_STATUSES },
      },
      data: { status: "REFUNDED" },
    });
    if (updated.count === 0) return false;

    // 演示退款：恢复孤品库存；已被后台改成其它状态的商品不强行覆盖。
    for (const productId of productIds) {
      await tx.product.updateMany({
        where: { id: productId, status: "SOLD" },
        data: { status: "ON_SALE", stock: 1 },
      });
    }
    return true;
  });

  if (!refunded) {
    const latest = await prisma.order.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (latest?.status === "REFUNDED") {
      return NextResponse.json({ ok: true, status: "REFUNDED" });
    }
    return NextResponse.json(
      { error: "订单状态已变化，请刷新后重试" },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true, status: "REFUNDED" });
}
