import { ComingSoon } from "@/components/layout/coming-soon";

export const metadata = { title: "商品" };

export default function ProductsPage() {
  return (
    <ComingSoon
      milestone="M1"
      title="商品列表与详情"
      description="M0 已完成商品模型与种子数据，M1 接入浏览、搜索、筛选与详情页。"
    />
  );
}
