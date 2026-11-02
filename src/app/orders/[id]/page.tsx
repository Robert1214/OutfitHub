import Image from "next/image";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";
import { OrderActions } from "@/components/orders/order-actions";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import { formatDateTime, formatPrice } from "@/lib/format";
import {
  ORDER_STATUS_LABELS,
  readAddressSnapshot,
  readProductSnapshot,
} from "@/lib/orders";

export const instant = false;
export const metadata = { title: "订单详情" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireUser(`/orders/${id}`);

  const order = await prisma.order.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!order) {
    const exists = await prisma.order.findUnique({
      where: { id },
      select: { id: true },
    });
    if (exists) forbidden();
    notFound();
  }

  const address = readAddressSnapshot(order.addressSnapshot);
  const snapshots = order.items.map((item) => ({
    item,
    product: readProductSnapshot(item.productSnapshot),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/orders"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            ← 返回我的订单
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            订单详情
          </h1>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {order.orderNo}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
            {ORDER_STATUS_LABELS[order.status]}
          </span>
          <OrderActions orderId={order.id} status={order.status} />
        </div>
      </div>

      <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
        演示订单：支付、物流与退款均为模拟，不涉及真实资金或真实发货。
      </p>

      {order.trackingNo ? (
        <div className="mt-4 rounded-lg border bg-card p-4 text-sm">
          <span className="text-muted-foreground">演示物流单号：</span>
          <span className="font-mono font-medium">{order.trackingNo}</span>
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            演示
          </span>
        </div>
      ) : null}

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">商品快照</h2>
        <div className="mt-4 space-y-4">
          {snapshots.map(({ item, product }) => (
            <div key={item.id} className="flex gap-3">
              <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="80px"
                    className="object-contain"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {product.categoryName}
                </p>
                {product.slug ? (
                  <Link
                    href={`/products/${product.slug}`}
                    className="line-clamp-1 text-sm font-medium hover:underline"
                  >
                    {product.name}
                  </Link>
                ) : (
                  <p className="line-clamp-1 text-sm font-medium">
                    {product.name}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {product.color}
                  {product.sizeLabel ? ` · ${product.sizeLabel}` : ""}
                </p>
                <p className="mt-2 text-sm font-medium">
                  {formatPrice(item.priceCents)}
                </p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-between border-t pt-4 text-sm">
          <span className="text-muted-foreground">订单总额</span>
          <span className="text-base font-semibold">
            {formatPrice(order.totalCents)}
          </span>
        </div>
      </section>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">收货地址快照</h2>
          <div className="mt-3 text-sm">
            <p className="font-medium">
              {address.recipient} · {address.phone}
            </p>
            <p className="mt-2 leading-6 text-muted-foreground">
              {address.province} {address.city} {address.district}{" "}
              {address.detail}
            </p>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">订单信息</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">支付方式</dt>
              <dd>演示支付（Mock）</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">下单时间</dt>
              <dd>{formatDateTime(order.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">支付时间</dt>
              <dd>
                {order.paidAt ? formatDateTime(order.paidAt) : "未支付"}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5">
        <h2 className="text-base font-semibold">状态时间线</h2>
        <ol className="mt-4 space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground" />
            <div>
              <p className="font-medium">订单创建</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(order.createdAt)}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${
                order.paidAt ? "bg-foreground" : "bg-muted-foreground/30"
              }`}
            />
            <div>
              <p className="font-medium">演示支付</p>
              <p className="text-xs text-muted-foreground">
                {order.paidAt
                  ? formatDateTime(order.paidAt)
                  : "未支付（演示）"}
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span
              className={`mt-1.5 size-2 shrink-0 rounded-full ${
                order.trackingNo ? "bg-foreground" : "bg-muted-foreground/30"
              }`}
            />
            <div>
              <p className="font-medium">发货（演示）</p>
              <p className="text-xs text-muted-foreground">
                {order.trackingNo
                  ? `演示物流单号 ${order.trackingNo}`
                  : "待后台发货（演示）"}
              </p>
            </div>
          </li>
          {order.status === "REFUNDED" ? (
            <li className="flex gap-3">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-foreground" />
              <div>
                <p className="font-medium">已退款（演示）</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(order.updatedAt)} · 不涉及真实资金
                </p>
              </div>
            </li>
          ) : null}
        </ol>
      </section>

      <div className="mt-6">
        <Link
          href="/products"
          className={buttonVariants({ variant: "outline" })}
        >
          继续逛逛
        </Link>
      </div>
    </div>
  );
}
