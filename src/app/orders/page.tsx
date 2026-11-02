import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/lib/auth-guards";

export const instant = false;
export const metadata = { title: "我的订单" };

export default async function OrdersPage() {
  await requireUser("/orders");
  return (
    <ComingSoon
      milestone="M3"
      title="我的订单"
      description="订单列表、详情与演示支付将在 M3 接入。"
    />
  );
}
