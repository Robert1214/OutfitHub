import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCartItems, getOrCreateCart } from "@/lib/cart-server";
import { prisma } from "@/lib/db";
import { cartActionSchema } from "@/lib/validations/cart";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const items = await getCartItems(session.user.id);
  return NextResponse.json({ items });
}

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

  const parsed = cartActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }

  const userId = session.user.id;
  const cart = await getOrCreateCart(userId);
  const action = parsed.data;

  try {
    if (action.action === "add") {
      const product = await prisma.product.findFirst({
        where: { id: action.productId, status: "ON_SALE" },
        select: { id: true, name: true },
      });
      if (!product) {
        return NextResponse.json(
          { error: "这件商品已售出或不存在" },
          { status: 409 },
        );
      }

      const existing = await prisma.cartItem.findUnique({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: action.productId,
          },
        },
      });
      if (existing) {
        if (!existing.selected) {
          await prisma.cartItem.update({
            where: { id: existing.id },
            data: { selected: true },
          });
        }
        return NextResponse.json({ added: false });
      }

      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId: action.productId,
          selected: true,
        },
      });
      return NextResponse.json({ added: true });
    }

    if (action.action === "remove") {
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id, productId: action.productId },
      });
      return NextResponse.json({ ok: true });
    }

    if (action.action === "select") {
      if (action.selected) {
        const product = await prisma.product.findFirst({
          where: {
            id: action.productId,
            status: "ON_SALE",
            stock: { gt: 0 },
          },
          select: { id: true },
        });
        if (!product) {
          return NextResponse.json(
            { error: "这件商品已售出，不能勾选" },
            { status: 409 },
          );
        }
      }
      await prisma.cartItem.updateMany({
        where: { cartId: cart.id, productId: action.productId },
        data: { selected: action.selected },
      });
      return NextResponse.json({ ok: true });
    }

    if (action.action === "selectAll") {
      await prisma.cartItem.updateMany({
        where: action.selected
          ? {
              cartId: cart.id,
              product: {
                is: { status: "ON_SALE", stock: { gt: 0 } },
              },
            }
          : { cartId: cart.id },
        data: { selected: action.selected },
      });
      return NextResponse.json({ ok: true });
    }

    // merge：游客 localStorage 合并到 DB，同商品保留已有记录
    const productIds = [...new Set(action.items.map((item) => item.productId))];
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    const validIds = new Set(existingProducts.map((product) => product.id));
    let merged = 0;

    for (const item of action.items) {
      if (!validIds.has(item.productId)) continue;
      await prisma.cartItem.upsert({
        where: {
          cartId_productId: {
            cartId: cart.id,
            productId: item.productId,
          },
        },
        update: {},
        create: {
          cartId: cart.id,
          productId: item.productId,
          selected: item.selected ?? true,
        },
      });
      merged += 1;
    }

    return NextResponse.json({ merged });
  } catch (error) {
    console.error(
      "购物车操作失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "购物车操作失败，请稍后重试" },
      { status: 500 },
    );
  }
}
