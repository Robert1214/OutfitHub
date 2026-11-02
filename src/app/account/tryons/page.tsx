import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/lib/auth-guards";

export const instant = false;
export const metadata = { title: "我的试穿" };

export default async function TryonsPage() {
  await requireUser("/account/tryons");
  return (
    <ComingSoon
      milestone="M4"
      title="我的试穿"
      description="试穿结果、合身判断与历史记录将在 M4 接入。"
    />
  );
}
