import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { prisma } from "../src/lib/db";
import { GET } from "../src/app/api/assistant/products/route";
import { catalogProductSelect, type CatalogReader } from "../src/lib/assistant-catalog";
import { queryAnchoredOutfits } from "../src/lib/assistant-outfits";
import { assistantRequirementsSchema, type AssistantRequirements } from "../src/lib/assistant-requirements";

after(async () => { await prisma.$disconnect(); });
const demand: AssistantRequirements = {
  q: "极简裤子", intent: "outfit", category: "bottoms", requestedCategories: ["bottoms"],
  styleTags: ["极简"], budgetCents: 80000, budgetScope: "total", includeCurrentProduct: true,
  otherRequirements: ["不要鞋", "通勤"], missingInformation: [],
};
const neverRead: CatalogReader = { async findMany() { throw new Error("must not query"); } };
const anchor = () => prisma.product.findUniqueOrThrow({ where: { slug: "black-silk-shirt" }, select: catalogProductSelect });
const pants = () => prisma.product.findUniqueOrThrow({ where: { slug: "black-wide-leg-pants" }, select: catalogProductSelect });

test("page context is not selection; missing, conflicting and ambiguous anchors/budgets clarify", async () => {
  for (const [requirements, pageId] of [
    [demand, "page-id"],
    [{ ...demand, anchorProductId: "selected-id" }, ""],
    [{ ...demand, anchorProductId: "selected-id" }, "other-page-id"],
    [{ ...demand, anchorProductId: "page-id", includeCurrentProduct: null }, "page-id"],
    [{ ...demand, anchorProductId: "page-id", budgetScope: "item" }, "page-id"],
    [{ ...demand, anchorProductId: "page-id", category: "", requestedCategories: [] }, "page-id"],
  ] as [AssistantRequirements, string][]) {
    const result = await queryAnchoredOutfits(requirements, neverRead, pageId);
    assert.equal(result.status, "needs_clarification");
    assert.deepEqual(result.products, []);
    assert.equal(result.currentProduct, null);
  }
});

test("live approved pair sums both prices with exact boundary and renewed budget", async () => {
  const [a, p] = await Promise.all([anchor(), pants()]);
  const total = a.priceCents + p.priceCents;
  assert.equal(total, 81800, "fixture prices changed: update product acceptance evidence");
  for (const budgetCents of [80000, 90000, total, total - 1, 0]) {
    const result = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id, budgetCents }, prisma.product, a.id);
    assert.equal(result.status, budgetCents >= total ? "matched_known_constraints" : "over_budget");
    assert.equal(result.currentProduct?.id, a.id);
    assert.equal(result.currentProductSource, "catalog_page_context");
    if (budgetCents >= total) {
      assert.deepEqual(result.products.map(p => p.id), [p.id]);
      assert.equal(result.outfits[0].outfitTotalCents, total);
      assert.equal(result.outfits[0].assessedPriceCents, total);
      assert.equal(result.outfits[0].budgetRemainderCents, budgetCents - total);
      assert.equal(result.products.some(p => p.id === a.id), false);
    } else {
      // D01-1: over-budget still shows the nearest reviewed pair, named and carded.
      assert.deepEqual(result.products.map(p => p.id), [p.id]);
      assert.equal(result.outfits[0].candidateProductName, p.name);
      assert.equal(result.outfits[0].assessedPriceCents, total);
      assert.equal(result.budgetAssessment?.minimumPriceCents, total);
      assert.equal(result.budgetAssessment?.overByCents, total - budgetCents);
    }
  }
});

test("already-owned anchor charges only the new candidate; no budget is not zero", async () => {
  const a = await anchor();
  const owned = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id, budgetScope: "item", includeCurrentProduct: false, budgetCents: 40000 }, prisma.product, a.id);
  assert.equal(owned.status, "matched_known_constraints");
  assert.equal(owned.outfits[0].assessedPriceCents, 35900);
  assert.equal(owned.outfits[0].budgetRemainderCents, 4100);
  const noBudget = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id, budgetScope: "none", budgetCents: null, includeCurrentProduct: null }, prisma.product, a.id);
  assert.equal(noBudget.status, "matched_known_constraints");
  assert.equal(noBudget.outfits[0].budgetRemainderCents, null);
  assert.equal(noBudget.checkedConstraints.some(v => v.includes("预算")), false);
});

test("shared style or price never creates an unreviewed pair; other requirements survive", async () => {
  const unreviewed = await prisma.product.findUniqueOrThrow({ where: { slug: "grey-knit-vest" } });
  const result = await queryAnchoredOutfits({ ...demand, anchorProductId: unreviewed.id, budgetCents: 90000 }, prisma.product, unreviewed.id);
  assert.equal(result.status, "needs_verification");
  assert.deepEqual(result.products, []);
  const a = await anchor();
  const unverified = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id, otherRequirements: ["不要鞋", "腰围必须合适"] }, prisma.product, a.id);
  assert.equal(unverified.status, "needs_verification");
  assert.deepEqual(unverified.unresolvedRequirements, ["腰围必须合适"]);
  const excluded = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id, otherRequirements: ["不要裤子"] }, prisma.product, a.id);
  assert.equal(excluded.status, "needs_clarification");
});

test("candidate categories, styles and approved scope are never relaxed to fill recommendations", async () => {
  const a = await anchor();
  for (const change of [
    { q: "摇滚裤子", styleTags: ["摇滚"] },
    { q: "极简半身裙" },
    { q: "不存在品牌裤子" },
  ]) {
    const result = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id, budgetCents: 90000, ...change }, prisma.product, a.id);
    assert.equal(result.status, "no_match_for_query");
    assert.equal(result.selectionScope, "owner_reviewed_pairs");
    assert.deepEqual(result.products, []);
  }
  const multi = await queryAnchoredOutfits({ ...demand, category: "", requestedCategories: ["tops", "bottoms"] }, neverRead);
  assert.equal(multi.status, "unsupported_request");
});

test("unavailable anchors cannot be sold in a pair; read-only clone simulates sold stock", async () => {
  const a = await anchor();
  const soldReader: CatalogReader = { async findMany(args) {
    if (args.where.id === a.id) return [{ ...a, status: "SOLD", stock: 0 }];
    return prisma.product.findMany(args);
  } };
  const sold = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id }, soldReader, a.id);
  assert.equal(sold.status, "anchor_unavailable");
  assert.deepEqual(sold.products, []);
  const owned = await queryAnchoredOutfits({ ...demand, anchorProductId: a.id, includeCurrentProduct: false, budgetScope: "item", budgetCents: 40000 }, soldReader, a.id);
  assert.equal(owned.status, "matched_known_constraints");
  const missing = await queryAnchoredOutfits({ ...demand, anchorProductId: "missing-id" }, { async findMany() { return []; } }, "missing-id");
  assert.equal(missing.status, "needs_clarification");
});

test("published code-node parser preserves the new anchor field and rejects malformed IDs", () => {
  const parse = runInNewContext(readFileSync("scripts/dify-parse-requirements.js", "utf8") + "; main;");
  const input = { ...demand, anchorProductId: "real-page-id" };
  const parsed = JSON.parse(parse({ text: JSON.stringify(input) }).requirements);
  assert.deepEqual(assistantRequirementsSchema.parse(parsed), input);
  assert.doesNotThrow(() => parse({ text: JSON.stringify(demand) }));
  for (const anchorProductId of [123, "", "x".repeat(51)]) {
    assert.throws(() => parse({ text: JSON.stringify({ ...demand, anchorProductId }) }));
    assert.equal(assistantRequirementsSchema.safeParse({ ...demand, anchorProductId }).success, false);
  }
});

test("existing HTTP parameters route outfit with a verified page anchor and keep single search isolated", async () => {
  const a = await anchor();
  const token = process.env.ASSISTANT_TOOL_TOKEN?.trim();
  assert.ok(token);
  const url = new URL("http://localhost/api/assistant/products");
  url.searchParams.set("requirements", JSON.stringify({ ...demand, anchorProductId: a.id, budgetCents: 90000 }));
  url.searchParams.set("contextProductId", a.id);
  url.searchParams.set("limit", "4");
  const response = await GET(new Request(url, { headers: { "x-assistant-token": token } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.scope, "catalog_anchored_outfit");
  assert.equal(body.status, "matched_known_constraints");
  assert.equal(body.outfits[0].budgetRemainderCents, 8200);
  url.searchParams.set("requirements", JSON.stringify({ ...demand, intent: "search", anchorProductId: null, budgetCents: 40000, budgetScope: "item", includeCurrentProduct: null, otherRequirements: ["不要鞋"] }));
  const search = await (await GET(new Request(url, { headers: { "x-assistant-token": token } }))).json();
  assert.equal(search.scope, "catalog_single_item");
  assert.equal(search.currentProduct, null);
  assert.equal(search.products.some((p: { id: string }) => p.id === a.id), false);
});
