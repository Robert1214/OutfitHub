"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { readRecentLastOrder } from "@/lib/checkout";

/**
 * 结算页刷新后购物车已空：如果本 tab 刚创建过订单，
 * 跳回订单详情，避免用户误以为下单失败。
 */
export function CheckoutRecovery() {
  const router = useRouter();

  useEffect(() => {
    const orderId = readRecentLastOrder();
    if (orderId) {
      router.replace(`/orders/${orderId}`);
    }
  }, [router]);

  return null;
}
