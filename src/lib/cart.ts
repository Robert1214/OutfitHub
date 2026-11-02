"use client";

export const CART_STORAGE_KEY = "outfitexpert-cart-v1";
export const CART_UPDATED_EVENT = "outfitexpert:cart-updated";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  selected: boolean;
  addedAt: string;
};

type CartItemInput = Omit<CartItem, "selected" | "addedAt">;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productId === "string" &&
    typeof item.slug === "string" &&
    typeof item.name === "string" &&
    typeof item.priceCents === "number" &&
    (typeof item.imageUrl === "string" || item.imageUrl === null) &&
    typeof item.selected === "boolean" &&
    typeof item.addedAt === "string"
  );
}

export function readCart(): CartItem[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]): void {
  if (!hasStorage()) return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

export function addToCart(item: CartItemInput): "added" | "duplicate" {
  const items = readCart();
  if (items.some((existing) => existing.productId === item.productId)) {
    return "duplicate";
  }
  writeCart([
    ...items,
    {
      ...item,
      selected: true,
      addedAt: new Date().toISOString(),
    },
  ]);
  return "added";
}

export function getCartCount(): number {
  return readCart().length;
}

export function updateLocalCartItem(
  productId: string,
  updater: (item: CartItem) => CartItem,
): void {
  writeCart(
    readCart().map((item) =>
      item.productId === productId ? updater(item) : item,
    ),
  );
}

export function setAllLocalSelected(selected: boolean): void {
  writeCart(readCart().map((item) => ({ ...item, selected })));
}

export function removeLocalCartItem(productId: string): void {
  writeCart(readCart().filter((item) => item.productId !== productId));
}

export function clearLocalCart(): void {
  if (!hasStorage()) return;
  window.localStorage.removeItem(CART_STORAGE_KEY);
  window.dispatchEvent(new Event(CART_UPDATED_EVENT));
}

/** 登录成功后把游客购物车合并到 DB；成功后清空本地。 */
export async function mergeLocalCartToServer(): Promise<boolean> {
  const items = readCart();
  if (!hasStorage() || items.length === 0) return true;

  try {
    const response = await fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "merge",
        items: items.map((item) => ({
          productId: item.productId,
          selected: item.selected,
        })),
      }),
    });
    if (!response.ok) return false;
    clearLocalCart();
    return true;
  } catch {
    return false;
  }
}
