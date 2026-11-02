"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CART_UPDATED_EVENT } from "@/lib/cart";
import { clearLastOrder, rememberLastOrder } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";

type CheckoutAddress = {
  id: string;
  recipient: string;
  phone: string;
  province: string;
  city: string;
  district: string;
  detail: string;
  isDefault: boolean;
};

type CheckoutItem = {
  id: string;
  productId: string;
  product: {
    name: string;
    priceCents: number;
    imageUrl: string | null;
    categoryName: string;
    color: string;
    sizeLabel: string | null;
  };
};

const KEY_STORAGE = "wardrobe.checkout.idempotency";
const FINGERPRINT_STORAGE = "wardrobe.checkout.fingerprint";

/** 幂等键按「本次勾选商品指纹」复用；商品变化则自动换新会话。 */
function getCheckoutKey(fingerprint: string): string {
  const storedFingerprint = window.sessionStorage.getItem(
    FINGERPRINT_STORAGE,
  );
  if (storedFingerprint !== fingerprint) {
    window.sessionStorage.setItem(FINGERPRINT_STORAGE, fingerprint);
    window.sessionStorage.removeItem(KEY_STORAGE);
  }

  let key = window.sessionStorage.getItem(KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    window.sessionStorage.setItem(KEY_STORAGE, key);
  }
  return key;
}

export function CheckoutForm({
  addresses,
  blocked = false,
  items,
  totalCents,
}: {
  addresses: CheckoutAddress[];
  blocked?: boolean;
  items: CheckoutItem[];
  totalCents: number;
}) {
  const router = useRouter();
  // 不用 useState 初始化默认地址：从地址页新增后回到结算时，
  // 组件可能被复用，旧 state 会停留在「无地址」。
  const defaultAddressId =
    addresses.find((address) => address.isDefault)?.id ??
    addresses[0]?.id ??
    "";
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const addressId =
    selectedAddressId &&
    addresses.some((address) => address.id === selectedAddressId)
      ? selectedAddressId
      : defaultAddressId;
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const fingerprint = useMemo(
    () =>
      items
        .map((item) => item.productId)
        .sort()
        .join(","),
    [items],
  );

  // 有商品可结算时，清掉上一单的恢复标记。
  useEffect(() => {
    clearLastOrder();
  }, []);

  async function pay() {
    if (blocked) {
      toast.error("请先回购物车取消勾选已售出的商品");
      return;
    }
    if (!addressId) {
      toast.error("请先选择收货地址");
      return;
    }
    if (paying) return;

    const idempotencyKey = getCheckoutKey(fingerprint);
    setPaying(true);
    setPayError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addressId, idempotencyKey }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        orderId?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          router.push(`/login?next=${encodeURIComponent("/checkout")}`);
          return;
        }
        const message = data.error ?? "下单失败，请稍后重试";
        if (response.status === 409 && message.includes("买走")) {
          toast.error(message);
          setConfirmOpen(false);
          router.push("/cart");
          router.refresh();
          return;
        }
        setPayError(message);
        return;
      }

      if (!data.orderId) {
        setPayError("下单失败，请稍后重试");
        return;
      }

      window.sessionStorage.removeItem(KEY_STORAGE);
      window.sessionStorage.removeItem(FINGERPRINT_STORAGE);
      rememberLastOrder(data.orderId);
      window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      setConfirmOpen(false);
      router.push(
        `/checkout/success?order=${encodeURIComponent(data.orderId)}`,
      );
      router.refresh();
    } catch {
      setPayError("网络异常，请检查连接后重试");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <section className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">收货地址</h2>
            <Link
              href="/account/addresses?next=%2Fcheckout"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              + 新增 / 管理地址
            </Link>
          </div>

          {addresses.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                还没有收货地址，先新增一个才能支付。
              </p>
              <Link
                href="/account/addresses?next=%2Fcheckout"
                className={buttonVariants({ variant: "outline", className: "mt-4" })}
              >
                去新增地址
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {addresses.map((address) => (
                <label
                  key={address.id}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition ${
                    addressId === address.id
                      ? "border-foreground bg-muted/30"
                      : "hover:border-foreground/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="addressId"
                    value={address.id}
                    checked={addressId === address.id}
                    onChange={() => setSelectedAddressId(address.id)}
                    className="mt-1 size-4 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 text-sm">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {address.recipient}
                      <span className="text-muted-foreground">
                        {address.phone}
                      </span>
                      {address.isDefault ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          默认
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      {address.province} {address.city} {address.district}{" "}
                      {address.detail}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">商品清单</h2>
          <div className="mt-4 space-y-4">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {item.product.imageUrl ? (
                    <Image
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      fill
                      sizes="80px"
                      className="object-contain"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {item.product.categoryName}
                  </p>
                  <p className="line-clamp-1 text-sm font-medium">
                    {item.product.name}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.product.color}
                    {item.product.sizeLabel
                      ? ` · ${item.product.sizeLabel}`
                      : ""}
                  </p>
                  <p className="mt-2 text-sm font-medium">
                    {formatPrice(item.product.priceCents)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-5">
          <h2 className="text-base font-semibold">支付方式</h2>
          <div className="mt-4 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">演示支付（Mock）</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              不接支付网关，不会真实扣款。点击支付后直接创建订单，商品标记为已售出。
            </p>
          </div>
        </section>
      </div>

      <aside className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-24">
        <p className="text-sm font-medium">订单确认</p>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>商品小计</dt>
            <dd>{formatPrice(totalCents)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>运费</dt>
            <dd>¥0.00（演示包邮）</dd>
          </div>
          <div className="flex justify-between border-t pt-3 text-base font-medium">
            <dt>应付合计</dt>
            <dd>{formatPrice(totalCents)}</dd>
          </div>
        </dl>

        <Button
          className="mt-5 w-full"
          size="lg"
          disabled={!addressId || paying || blocked}
          onClick={() => {
            setPayError("");
            setConfirmOpen(true);
          }}
        >
          {blocked
            ? "请先处理售罄商品"
            : addresses.length === 0
              ? "请先新增地址"
              : "演示支付"}
        </Button>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          演示环境：不会真实扣款；下单后商品即标记为售出。重复点击不会重复下单。
        </p>
      </aside>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认演示支付</DialogTitle>
            <DialogDescription>
              本操作不会产生真实扣款。确认后将创建订单、把商品标记为已售出，并从购物车移除已购商品。
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">应付合计</span>
              <span className="font-medium">{formatPrice(totalCents)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              演示支付 · 不接真实支付网关
            </p>
          </div>
          {payError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {payError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={paying}
            >
              再想想
            </Button>
            <Button onClick={() => void pay()} disabled={paying || !addressId}>
              {paying ? "处理中…" : "确认支付（演示）"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
