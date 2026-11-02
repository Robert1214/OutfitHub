import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";
import { readAddressSnapshot } from "@/lib/orders";

export const instant = false;
export const metadata = { title: "支付成功（演示）" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const orderId = typeof raw.order === "string" ? raw.order : "";
  if (!orderId) redirect("/orders");

  const session = await requireUser(
    `/checkout/success?order=${encodeURIComponent(orderId)}`,
  );

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: session.user.id },
    select: {
      id: true,
      orderNo: true,
      totalCents: true,
      status: true,
      addressSnapshot: true,
    },
  });
  if (!order) redirect("/orders");

  const address = readAddressSnapshot(order.addressSnapshot);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-2xl border bg-card p-8 text-center sm:p-12">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CircleCheck className="size-8" />
        </div>
        <p className="mt-6 text-xs tracking-[0.28em] text-muted-foreground">
          PAYMENT COMPLETE
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          支付成功（演示）
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          本操作不会产生真实扣款；商品已标记为售出，已从购物车移除。
        </p>

        <dl className="mx-auto mt-8 max-w-md space-y-3 rounded-xl border bg-muted/20 p-5 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">订单号</dt>
            <dd className="font-mono text-xs font-medium">{order.orderNo}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">实付金额</dt>
            <dd className="font-medium">{formatPrice(order.totalCents)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">收货人</dt>
            <dd className="text-right">
              {address.recipient} · {address.phone}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">收货地址</dt>
            <dd className="max-w-[70%] text-right text-muted-foreground">
              {address.province} {address.city} {address.district}{" "}
              {address.detail}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/orders/${order.id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            查看订单详情
          </Link>
          <Link href="/products" className={buttonVariants()}>
            继续逛逛
          </Link>
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          演示环境 · 不接真实支付网关 · 不产生真实交易
        </p>
      </div>
    </div>
  );
}
