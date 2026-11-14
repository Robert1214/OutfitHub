import { prisma } from "../src/lib/db";
import { queryCatalogProducts } from "../src/lib/assistant-catalog";

type Req = Parameters<typeof queryCatalogProducts>[0];

async function run(label: string, req: Req) {
  const r = (await queryCatalogProducts(req, prisma.product, 4)) as Record<string, unknown>;
  const products = (r.products as { name: string }[] | undefined) ?? [];
  console.log(`${label.padEnd(34)} status=${r.status} products=${products.length} ${products.map((p) => p.name).join("、")}`);
  if (products.length === 0) console.log("   clarification:", JSON.stringify(r.clarification ?? []), "unresolved:", JSON.stringify(r.unresolvedRequirements ?? []), "next:", String(r.nextAction).slice(0, 80));
}

const base: Req = {
  q: "", intent: "search", category: "bottoms", styleTags: [],
  budgetCents: 40000, budgetScope: "item", includeCurrentProduct: false,
  otherRequirements: [], missingInformation: [],
};

async function main() {
  await run("极简风格(hasEvery)", { ...base, styleTags: ["极简"] });
  await run("极简+利落", { ...base, styleTags: ["极简", "利落"] });
  await run("极简通勤", { ...base, styleTags: ["极简", "通勤"] });
  await run("无风格标签", { ...base });
  await run("q=极简", { ...base, q: "极简" });
  await prisma.$disconnect();
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
