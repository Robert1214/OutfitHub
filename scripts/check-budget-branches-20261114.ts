import { prisma } from "../src/lib/db";
const TOKEN = process.env.ASSISTANT_TOOL_TOKEN ?? "";
const req = (over: object) => ({
  intent: "outfit", q: "", category: "bottoms", requestedCategories: ["bottoms"],
  styleTags: [], budgetCents: 40000, budgetScope: "item", includeCurrentProduct: false,
  anchorProductId: "PLACEHOLDER_ID", otherRequirements: [], missingInformation: [], ...over,
});
async function call(name: string, body: object, contextProductId = "") {
  const qs = new URLSearchParams({
    requirements: JSON.stringify(body),
    limit: "4",
    contextProductId,
  });
  const res = await fetch(`http://localhost:3000/api/assistant/products?${qs}`, {
    method: "GET",
    headers: { "x-assistant-token": TOKEN },
  });
  const t = await res.text();
  console.log(`\n=== ${name} → HTTP ${res.status}`);
  try {
    const j = JSON.parse(t);
    console.log("status:", j.status, "| clarification:", JSON.stringify(j.clarification ?? []));
    console.log("budget:", JSON.stringify(j.budgetAssessment));
    console.log(
      "outfits:",
      (j.outfits ?? []).map((o: { candidateProductId: string; outfitTotalCents: number }) =>
        `${o.candidateProductId.slice(-6)} ¥${o.outfitTotalCents / 100}`).join(", ") || "（无）",
    );
  } catch { console.log(t.slice(0, 300)); }
}
async function main() {
  const anchor = await prisma.product.findFirst({ where: { slug: "black-silk-shirt" }, select: { id: true, name: true } });
  console.log("anchor:", anchor);
  const id = anchor!.id;
  await call("A. total/true（用户选定：总预算 800）", req({ anchorProductId: id }), id);
  await call("B. total/false", req({ anchorProductId: id, includeCurrentProduct: false }), id);
  await call("C. unknown/null（应追问）", req({ anchorProductId: id, budgetScope: "unknown", includeCurrentProduct: null }), id);
  await call("D. item/false", req({ anchorProductId: id, budgetScope: "item", includeCurrentProduct: false }), id);
  await call("E. 无预算", req({ anchorProductId: id, budgetCents: null, budgetScope: "none", includeCurrentProduct: false }), id);
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
