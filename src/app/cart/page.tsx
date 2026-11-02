import { CartView } from "@/components/cart/cart-view";

export const metadata = { title: "购物车" };

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <CartView />
    </div>
  );
}
