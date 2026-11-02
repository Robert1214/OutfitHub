import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/lib/auth-guards";

export const instant = false;
export const metadata = { title: "结算" };

export default async function CheckoutPage() {
  await requireUser("/checkout");
  return (
    <ComingSoon
      milestone="M3"
      title="结算与演示支付"
      description="地址、订单确认与 Mock 支付将在 M3 接入。"
    />
  );
}
