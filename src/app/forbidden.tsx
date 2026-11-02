import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="text-xs tracking-[0.28em] text-muted-foreground">403</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        没有权限访问
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        这个订单不属于当前账号，只能查看自己的订单。
      </p>
      <Link href="/orders" className={buttonVariants({ className: "mt-6" })}>
        返回我的订单
      </Link>
    </div>
  );
}
