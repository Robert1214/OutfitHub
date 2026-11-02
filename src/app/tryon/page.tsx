import { ComingSoon } from "@/components/layout/coming-soon";
import { requireUser } from "@/lib/auth-guards";

export const instant = false;
export const metadata = { title: "AI 试穿" };

export default async function TryonPage() {
  await requireUser("/tryon");
  return (
    <ComingSoon
      milestone="M4"
      title="AI 试穿"
      description="购物车勾选 1~4 件商品后，结合本人照片生成试穿效果图。"
    />
  );
}
