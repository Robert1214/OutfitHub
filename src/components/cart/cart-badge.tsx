"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CART_UPDATED_EVENT, getCartCount } from "@/lib/cart";

export function CartBadge() {
  const { data: session } = useSession();
  const userId = session?.user?.id;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;

    async function update() {
      if (userId) {
        try {
          const response = await fetch("/api/cart");
          if (!response.ok) {
            if (alive) setCount(0);
            return;
          }
          const data = (await response.json()) as { items?: unknown[] };
          if (alive) setCount(Array.isArray(data.items) ? data.items.length : 0);
        } catch {
          if (alive) setCount(0);
        }
        return;
      }
      if (alive) setCount(getCartCount());
    }

    void update();
    window.addEventListener(CART_UPDATED_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      alive = false;
      window.removeEventListener(CART_UPDATED_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [userId]);

  if (count === 0) return null;

  return (
    <span
      className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium leading-5 text-primary-foreground"
      aria-label={`购物车 ${count} 件`}
    >
      {count}
    </span>
  );
}
