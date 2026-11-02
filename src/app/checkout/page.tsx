import Link from "next/link";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { CheckoutRecovery } from "@/components/checkout/checkout-recovery";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guards";
import { getCartItems } from "@/lib/cart-server";
import { prisma } from "@/lib/db";

export const instant = false;
export const metadata = { title: "结算" };

export default async function CheckoutPage() {
  const session = await requireUser("/checkout");
  const userId = session.user.id;

  const [cartItems, addresses] = await Promise.all([
    getCartItems(userId),
    prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        recipient: true,
        phone: true,
        province: true,
        city: true,
        district: true,
        detail: true,
        isDefault: true,
      },
    }),
  ]);

  const selectedItems = cartItems.filter(
    (item) =>
      item.selected &&
      item.product.status === "ON_SALE" &&
      item.product.stock > 0,
  );
  const unavailableCount = cartItems.filter(
    (item) =>
      item.selected &&
      (item.product.status !== "ON_SALE" || item.product.stock <= 0),
  ).length;
  const totalCents = selectedItems.reduce(
    (sum, item) => sum + item.product.priceCents,
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          CHECKOUT
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">确认订单</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          演示环境 · 仅用于作品集展示，不产生真实交易
        </p>
      </div>

      {unavailableCount > 0 ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          有 {unavailableCount} 件已售出商品仍勾选在购物车中，请先
          <Link href="/cart" className="underline">
            回购物车
          </Link>
          取消勾选后再支付。
        </p>
      ) : null}

      {selectedItems.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-12 text-center">
          <CheckoutRecovery />
          <p className="text-lg font-medium">没有待结算商品</p>
          <p className="mt-2 text-sm text-muted-foreground">
            回购物车勾选 1 件或多件商品后再来结算。
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/cart"
              className={buttonVariants({ variant: "outline" })}
            >
              回购物车
            </Link>
            <Link href="/products" className={buttonVariants()}>
              去逛商品
            </Link>
          </div>
        </div>
      ) : (
        <CheckoutForm
          addresses={addresses}
          blocked={unavailableCount > 0}
          items={selectedItems.map((item) => ({
            id: item.id,
            productId: item.productId,
            product: {
              name: item.product.name,
              priceCents: item.product.priceCents,
              imageUrl: item.product.imageUrl,
              categoryName: item.product.categoryName,
              color: item.product.color,
              sizeLabel: item.product.sizeLabel,
            },
          }))}
          totalCents={totalCents}
        />
      )}
    </div>
  );
}
