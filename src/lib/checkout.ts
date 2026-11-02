const LAST_ORDER_KEY = "wardrobe.checkout.lastOrder";
const LAST_ORDER_MAX_AGE_MS = 10 * 60 * 1000;

type LastOrder = {
  orderId: string;
  at: number;
};

/** 记录刚创建的订单，刷新结算页时可恢复到订单详情。 */
export function rememberLastOrder(orderId: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(
    LAST_ORDER_KEY,
    JSON.stringify({ orderId, at: Date.now() } satisfies LastOrder),
  );
}

export function readRecentLastOrder(): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(LAST_ORDER_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<LastOrder>;
    if (
      typeof parsed.orderId === "string" &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at < LAST_ORDER_MAX_AGE_MS
    ) {
      return parsed.orderId;
    }
  } catch {
    // 忽略损坏的本地值
  }
  window.sessionStorage.removeItem(LAST_ORDER_KEY);
  return null;
}

export function clearLastOrder(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(LAST_ORDER_KEY);
}
