import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "购物车" };

export default function CartPage() {
  return (
    <ComingSoon
      milestone="M3"
      title="购物车与演示下单"
      description="M2 登录完成后，M3 接入游客/登录购物车、地址、演示支付与订单。"
    />
  );
}
