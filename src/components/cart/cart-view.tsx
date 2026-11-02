"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import {
  CART_UPDATED_EVENT,
  readCart,
  removeLocalCartItem,
  setAllLocalSelected,
  updateLocalCartItem,
  writeCart,
  type CartItem as LocalCartItem,
} from "@/lib/cart";

type ProductStatus = "DRAFT" | "ON_SALE" | "SOLD" | "ARCHIVED";
type RefType = "GARMENT" | "ACCESSORIES" | "SHOES";

type CartLine = {
  id: string;
  productId: string;
  selected: boolean;
  addedAt: string;
  product: {
    id: string;
    name: string;
    slug: string;
    priceCents: number;
    status: ProductStatus;
    stock: number;
    imageUrl: string | null;
    categoryName: string;
    color?: string;
    sizeLabel?: string | null;
    refType?: RefType;
  };
};

type ProductApiItem = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  status: ProductStatus;
  stock: number;
  imageUrl: string | null;
  categoryName: string;
};

function available(line: CartLine): boolean {
  return line.product.status === "ON_SALE" && line.product.stock > 0;
}

function fromLocal(
  local: LocalCartItem,
  product: ProductApiItem | undefined,
): CartLine {
  return {
    id: local.productId,
    productId: local.productId,
    selected: local.selected,
    addedAt: local.addedAt,
    product: {
      id: product?.id ?? local.productId,
      name: product?.name ?? local.name,
      slug: product?.slug ?? local.slug,
      priceCents: product?.priceCents ?? local.priceCents,
      status: product?.status ?? "SOLD",
      stock: product?.stock ?? 0,
      imageUrl: product?.imageUrl ?? local.imageUrl,
      categoryName: product?.categoryName ?? "",
    },
  };
}

export function CartView() {
  const { data: session, status } = useSession();
  const userId = session?.user?.id;
  const [items, setItems] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === "loading") return;
    let alive = true;

    async function load() {
      setLoading(true);
      let nextItems: CartLine[] = [];

      if (userId) {
        const response = await fetch("/api/cart");
        if (response.ok) {
          const data = (await response.json()) as { items?: CartLine[] };
          nextItems = data.items ?? [];
        }
      } else {
        const local = readCart();
        if (local.length > 0) {
          const ids = [...new Set(local.map((item) => item.productId))].join(
            ",",
          );
          const response = await fetch(
            `/api/products?ids=${encodeURIComponent(ids)}`,
          );
          const data = (await response.json()) as {
            products?: ProductApiItem[];
          };
          const productMap = new Map(
            (data.products ?? []).map((product) => [product.id, product]),
          );
          nextItems = local.map((item) =>
            fromLocal(item, productMap.get(item.productId)),
          );
        }
      }

      // 售罄商品强制取消勾选
      const unselectedSold = nextItems.filter(
        (item) => item.selected && !available(item),
      );
      if (unselectedSold.length > 0) {
        if (userId) {
          await Promise.all(
            unselectedSold.map((item) =>
              fetch("/api/cart", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "select",
                  productId: item.productId,
                  selected: false,
                }),
              }),
            ),
          );
        } else {
          writeCart(
            readCart().map((item) =>
              unselectedSold.some(
                (sold) => sold.productId === item.productId,
              )
                ? { ...item, selected: false }
                : item,
            ),
          );
        }
        nextItems = nextItems.map((item) =>
          unselectedSold.some((sold) => sold.productId === item.productId)
            ? { ...item, selected: false }
            : item,
        );
      }

      if (alive) {
        setItems(nextItems);
        setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, [userId, status]);

  async function postAction(body: Record<string, unknown>): Promise<boolean> {
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "操作失败，请稍后重试");
        return false;
      }
      return true;
    } catch {
      toast.error("操作失败，请稍后重试");
      return false;
    }
  }

  async function toggleItem(line: CartLine) {
    if (!available(line) || busy) return;
    setBusy(true);
    const nextSelected = !line.selected;

    if (session?.user) {
      const ok = await postAction({
        action: "select",
        productId: line.productId,
        selected: nextSelected,
      });
      if (ok) {
        setItems((current) =>
          current.map((item) =>
            item.productId === line.productId
              ? { ...item, selected: nextSelected }
              : item,
          ),
        );
        window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      }
    } else {
      updateLocalCartItem(line.productId, (item) => ({
        ...item,
        selected: nextSelected,
      }));
      setItems((current) =>
        current.map((item) =>
          item.productId === line.productId
            ? { ...item, selected: nextSelected }
            : item,
        ),
      );
    }
    setBusy(false);
  }

  async function toggleAll() {
    if (busy) return;
    setBusy(true);
    const selectable = items.filter(available);
    const nextSelected = !selectable.every((item) => item.selected);

    if (session?.user) {
      const ok = await postAction({ action: "selectAll", selected: nextSelected });
      if (ok) {
        setItems((current) =>
          current.map((item) => ({
            ...item,
            selected: available(item) ? nextSelected : false,
          })),
        );
        window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      }
    } else {
      setAllLocalSelected(nextSelected);
      setItems((current) =>
        current.map((item) => ({
          ...item,
          selected: available(item) ? nextSelected : false,
        })),
      );
    }
    setBusy(false);
  }

  async function removeItem(line: CartLine) {
    if (busy) return;
    setBusy(true);
    if (session?.user) {
      const ok = await postAction({
        action: "remove",
        productId: line.productId,
      });
      if (ok) {
        setItems((current) =>
          current.filter((item) => item.productId !== line.productId),
        );
        window.dispatchEvent(new Event(CART_UPDATED_EVENT));
      }
    } else {
      removeLocalCartItem(line.productId);
      setItems((current) =>
        current.filter((item) => item.productId !== line.productId),
      );
    }
    setBusy(false);
  }

  const selected = items.filter((item) => item.selected && available(item));
  const totalCents = selected.reduce(
    (sum, item) => sum + item.product.priceCents,
    0,
  );
  const selectable = items.filter(available);
  const allSelected =
    selectable.length > 0 && selectable.every((item) => item.selected);

  if (loading) {
    return (
      <div className="space-y-4" aria-hidden>
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
        <div className="h-28 animate-pulse rounded-xl border bg-muted/40" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-12 text-center">
        <p className="text-lg font-medium">购物车是空的</p>
        <p className="mt-2 text-sm text-muted-foreground">
          先去逛逛，每件衣服只有一件。
        </p>
        <Link
          href="/products"
          className={buttonVariants({ variant: "outline", className: "mt-5" })}
        >
          去逛商品
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted-foreground">
            CART
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">购物车</h1>
        </div>
        <p className="text-sm text-muted-foreground">共 {items.length} 件</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-2.5">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => void toggleAll()}
                disabled={busy || selectable.length === 0}
                className="size-4 accent-primary"
              />
              全选
            </label>
            <span className="text-xs text-muted-foreground">
              已选 {selected.length} 件
            </span>
          </div>

          {items.map((line) => {
            const isAvailable = available(line);
            return (
              <div
                key={line.id}
                className={`flex gap-3 rounded-xl border bg-card p-3 sm:gap-4 sm:p-4 ${
                  isAvailable ? "" : "opacity-70"
                }`}
              >
                <input
                  type="checkbox"
                  checked={line.selected && isAvailable}
                  onChange={() => void toggleItem(line)}
                  disabled={!isAvailable || busy}
                  aria-label={`选择 ${line.product.name}`}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted">
                  {line.product.imageUrl ? (
                    <Image
                      src={line.product.imageUrl}
                      alt={line.product.name}
                      fill
                      sizes="80px"
                      className="object-contain"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {line.product.categoryName}
                      </p>
                      <Link
                        href={`/products/${line.product.slug}`}
                        className="line-clamp-1 text-sm font-medium hover:underline"
                      >
                        {line.product.name}
                      </Link>
                    </div>
                    <p className="text-sm font-medium">
                      {formatPrice(line.product.priceCents)}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {isAvailable ? (
                      <span className="text-xs text-muted-foreground">
                        仅此一件
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        已售出
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void removeItem(line)}
                      disabled={busy}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="h-fit rounded-xl border bg-card p-5 lg:sticky lg:top-24">
          <p className="text-sm font-medium">订单摘要</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <dt>已选</dt>
              <dd>{selected.length} 件</dd>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <dt>运费</dt>
              <dd>¥0.00（演示包邮）</dd>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-medium">
              <dt>合计</dt>
              <dd>{formatPrice(totalCents)}</dd>
            </div>
          </dl>

          <div className="mt-5 space-y-2">
            {selected.length === 0 ? (
              <Button disabled className="w-full">
                去结算
              </Button>
            ) : session?.user ? (
              <Link
                href="/checkout"
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                去结算
              </Link>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent("/checkout")}`}
                className={buttonVariants({ size: "lg", className: "w-full" })}
              >
                登录后结算
              </Link>
            )}
            <Button variant="outline" className="w-full" disabled>
              AI 试穿（M4 开放）
            </Button>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            演示环境：结算不会产生真实扣款；售罄商品不参与合计。
          </p>
        </aside>
      </div>
    </div>
  );
}
