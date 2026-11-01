import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "导购助手" };

export default function AssistantPage() {
  return (
    <ComingSoon
      milestone="M5"
      title="Dify 导购助手"
      description="M5 接入 Dify Chatflow、商品卡片、引用来源与转人工。"
    />
  );
}
