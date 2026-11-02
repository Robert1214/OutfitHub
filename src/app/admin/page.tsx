import { ComingSoon } from "@/components/layout/coming-soon";
import { requireAdmin } from "@/lib/auth-guards";

export const instant = false;
export const metadata = { title: "后台" };

export default async function AdminPage() {
  await requireAdmin("/admin");
  return (
    <ComingSoon
      milestone="M6"
      title="后台管理"
      description="商品、订单与看板将在 M6 接入；当前仅验证管理员权限。"
    />
  );
}
