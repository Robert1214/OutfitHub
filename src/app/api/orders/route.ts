import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cartItemInclude } from "@/lib/cart-server";
import { prisma } from "@/lib/db";
import {
  createOrderNo,
  toAddressSnapshot,
  toProductSnapshot,
} from "@/lib/orders";
import { createOrderSchema } from "@/lib/validations/order";

class OrderInputError extends Error {}

class OrderConflictError extends Error {
  constructor(public readonly productName: string) {
    super("商品已售出");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = createOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "参数不正确" },
      { status: 400 },
    );
  }
  const { addressId, idempotencyKey } = parsed.data;

  // 幂等：同一结算会话重复提交直接返回已创建的订单。
  const existing = await prisma.order.findUnique({
    where: { idempotencyKey },
    select: { id: true, orderNo: true, userId: true },
  });
  if (existing) {
    if (existing.userId !== userId) {
      return NextResponse.json({ error: "请求冲突，请重试" }, { status: 409 });
    }
    return NextResponse.json({
      ok: true,
      orderId: existing.id,
      orderNo: existing.orderNo,
      duplicate: true,
    });
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });
  if (!address) {
    return NextResponse.json(
      { error: "请选择有效的收货地址" },
      { status: 400 },
    );
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            where: { selected: true },
            include: cartItemInclude,
            orderBy: { addedAt: "asc" },
          },
        },
      });

      if (!cart || cart.items.length === 0) {
        throw new OrderInputError("请先在购物车勾选商品");
      }
      const selected = cart.items;

      // 孤品：条件更新成功才算抢到；任何一件失败都回滚整个订单。
      for (const item of selected) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            status: "ON_SALE",
            stock: { gt: 0 },
          },
          data: { status: "SOLD", stock: 0 },
        });
        if (updated.count === 0) {
          throw new OrderConflictError(item.product.name);
        }
      }

      const totalCents = selected.reduce(
        (sum, item) => sum + item.product.priceCents,
        0,
      );

      const created = await tx.order.create({
        data: {
          orderNo: createOrderNo(),
          userId,
          addressSnapshot: toAddressSnapshot(address),
          totalCents,
          status: "PAID_DEMO",
          paymentMethod: "DEMO",
          paidAt: new Date(),
          idempotencyKey,
          items: {
            create: selected.map((item) => ({
              productId: item.productId,
              priceCents: item.product.priceCents,
              productSnapshot: toProductSnapshot(item.product),
            })),
          },
        },
        select: { id: true, orderNo: true },
      });

      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
          productId: { in: selected.map((item) => item.productId) },
        },
      });

      return created;
    });

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      orderNo: order.orderNo,
    });
  } catch (error) {
    if (error instanceof OrderConflictError) {
      return NextResponse.json(
        { error: `「${error.productName}」已被别人买走，请回购物车调整` },
        { status: 409 },
      );
    }
    if (error instanceof OrderInputError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 并发重复提交同一幂等键：另一个请求已成功，返回那一单。
    if (isUniqueViolation(error)) {
      const duplicate = await prisma.order.findUnique({
        where: { idempotencyKey },
        select: { id: true, orderNo: true, userId: true },
      });
      if (duplicate && duplicate.userId === userId) {
        return NextResponse.json({
          ok: true,
          orderId: duplicate.id,
          orderNo: duplicate.orderNo,
          duplicate: true,
        });
      }
    }

    console.error(
      "创建订单失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "下单失败，请稍后重试" },
      { status: 500 },
    );
  }
}
