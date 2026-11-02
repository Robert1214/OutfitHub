import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  isOrderStatus,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_OPTIONS,
  readProductSnapshot,
} from "@/lib/orders";

export const instant = false;
export const metadata = { title: "我的订单" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireUser("/orders");
  const raw = await searchParams;
  const status = isOrderStatus(raw.status) ? raw.status : null;

  const orders = await prisma.order.findMany({
    where: {
      userId: session.user.id,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: { orderBy: { createdAt: "asc" } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div>
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          ORDERS
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">我的订单</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          演示环境 · 所有支付与物流均为模拟，不产生真实交易
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/orders"
          className={buttonVariants({
            variant: status ? "outline" : "secondary",
            size: "sm",
          })}
        >
          全部
        </Link>
        {ORDER_STATUS_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/orders?status=${option.value}`}
            className={buttonVariants({
              variant: status === option.value ? "secondary" : "outline",
              size: "sm",
            })}
          >
            {option.label}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-12 text-center">
          <p className="text-lg font-medium">
            {status ? "这个状态下还没有订单" : "还没有订单"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            去逛逛，挑一件喜欢的；演示支付不会真实扣款。
          </p>
          <Link
            href="/products"
            className={buttonVariants({ variant: "outline", className: "mt-5" })}
          >
            去逛商品
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {orders.map((order) => {
            const snapshots = order.items.map((item) =>
              readProductSnapshot(item.productSnapshot),
            );
            return (
              <article
                key={order.id}
                className="rounded-xl border bg-card p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-muted-foreground">
                      {order.orderNo}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {snapshots.slice(0, 4).map((snapshot, index) => (
                    <div
                      key={`${order.id}-${index}`}
                      className="relative h-16 w-14 overflow-hidden rounded-md border bg-muted"
                    >
                      {snapshot.imageUrl ? (
                        <Image
                          src={snapshot.imageUrl}
                          alt={snapshot.name}
                          fill
                          sizes="56px"
                          className="object-contain"
                        />
                      ) : null}
                    </div>
                  ))}
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 text-sm">
                      {snapshots.map((snapshot) => snapshot.name).join("、")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      共 {snapshots.length} 件
                    </p>
                  </div>
                  <p className="text-sm font-medium">
                    {formatPrice(order.totalCents)}
                  </p>
                </div>

                <div className="mt-4 flex justify-end border-t pt-3">
                  <Link
                    href={`/orders/${order.id}`}
                    className={buttonVariants({
                      variant: "outline",
                      size: "sm",
                    })}
                  >
                    查看详情
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
