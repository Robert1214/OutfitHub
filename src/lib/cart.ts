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
