import { prisma } from "../src/lib/db";
const TOKEN = process.env.ASSISTANT_TOOL_TOKEN ?? "";

type OutfitBody = {
  status: string;
  purchaseBasis?: string;
  reportedPriceCents?: number | null;
  priceBasisNote?: string;
  budgetAssessment?: { minimumPriceCents: number; overByCents: number; includesAnchor: boolean } | null;
  outfits: { assessedPriceCents: number; outfitTotalCents: number }[];
  products: unknown[];
};

async function call(label: string, over: Record<string, unknown>, anchorId: string) {
  const body = {
    intent: "outfit", q: "", category: "bottoms", requestedCategories: ["bottoms"],
    styleTags: [], budgetCents: 40000, budgetScope: "item", includeCurrentProduct: false,
    anchorProductId: anchorId, otherRequirements: [], missingInformation: [], ...over,
  };
  const qs = new URLSearchParams({ requirements: JSON.stringify(body), limit: "4", contextProductId: anchorId });
  const res = await fetch(`http://localhost:3000/api/assistant/products?${qs}`, {
    headers: { "x-assistant-token": TOKEN },
  });
  const j = (await res.json()) as OutfitBody;
  const yuan = (c?: number | null) => (c == null ? "-" : `¥${(c / 100).toFixed(0)}`);
  console.log(
    `${label.padEnd(30)} HTTP ${res.status} status=${j.status} basis=${j.purchaseBasis ?? "-"}` +
      ` reported=${yuan(j.reportedPriceCents)} assessed=${yuan(j.outfits?.[0]?.assessedPriceCents)}` +
      ` total=${yuan(j.outfits?.[0]?.outfitTotalCents)} note=${j.priceBasisNote ? "有" : "无"}`,
  );
}

async function main() {
  const anchor = await prisma.product.findFirst({ where: { slug: "black-silk-shirt" }, select: { id: true } });
  const id = anchor!.id;
  await call("A 单件400/只买下装", {}, id);
  await call("B 单件300/只买下装(应超59)", { budgetCents: 30000 }, id);
  await call("C 总预算800/含上衣(应818超18)", { budgetCents: 80000, budgetScope: "total", includeCurrentProduct: true }, id);
  await call("D 总预算700/含上衣(应超118)", { budgetCents: 70000, budgetScope: "total", includeCurrentProduct: true }, id);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
