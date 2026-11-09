import assert from "node:assert/strict";
import { test } from "node:test";
import { querySampleProducts, sampleRequirementsSchema } from "../src/lib/assistant-samples";
import { GET } from "../src/app/api/assistant/sample-products/route";

const demand = {
  q: "摇滚风裤子", intent: "outfit" as const, category: "bottoms" as const,
  styleTags: ["摇滚风"], budgetCents: 80000, budgetScope: "total" as const,
  includeCurrentProduct: true, otherRequirements: ["不要鞋"], missingInformation: [],
};

test("800/500/600 yuan use both prices and never substitute the rejected pants", () => {
  for (const budget of [80000, 50000, 60000]) {
    const result = querySampleProducts({ ...demand, budgetCents: budget }, "S01");
    const correct = result.evaluations.find((p) => p.product.sampleId === "S03")!;
    assert.equal(correct.assessedPriceCents, 55600);
    assert.equal(correct.differenceCents, budget - 55600);
    assert.equal(result.evaluations.find((p) => p.product.sampleId === "S02")!.pairCompatible, false);
    assert.deepEqual(result.products.map((p) => p.sampleId), budget < 55600 ? [] : ["S03"]);
    assert.equal(result.status, budget < 55600 ? "over_budget" : "matched_known_constraints");
  }
});

test("exact boundary and zero budget do not default to unlimited", () => {
  assert.equal(querySampleProducts({ ...demand, budgetCents: 55600 }, "S01").products.length, 1);
  assert.equal(querySampleProducts({ ...demand, budgetCents: 55599 }, "S01").products.length, 0);
  assert.equal(querySampleProducts({ ...demand, budgetCents: 0 }, "S01").status, "over_budget");
});

test("unknown budget scope or anchor cannot create a successful outfit", () => {
  assert.equal(querySampleProducts({ ...demand, includeCurrentProduct: null }, "S01").status, "needs_clarification");
  assert.equal(querySampleProducts(demand, "").status, "needs_clarification");
  assert.equal(querySampleProducts({ ...demand, budgetScope: "unknown" }, "S01").products.length, 0);
  assert.equal(querySampleProducts({ ...demand, missingInformation: ["预算范围"] }, "S01").products.length, 0);
});

test("owning the anchor and single item budgets charge only the pants", () => {
  const owned = querySampleProducts({ ...demand, budgetCents: 40000, includeCurrentProduct: false }, "S01");
  assert.equal(owned.evaluations.find((p) => p.product.sampleId === "S03")!.assessedPriceCents, 36800);
  assert.equal(owned.products.length, 1);
  const single = querySampleProducts({ ...demand, intent: "search", budgetScope: "item", includeCurrentProduct: null }, "");
  assert.equal(single.evaluations.find((p) => p.product.sampleId === "S03")!.assessedPriceCents, 36800);
});

test("no budget stays unknown and unrecorded matches never become true", () => {
  const result = querySampleProducts({ ...demand, budgetCents: null, budgetScope: "none" }, "S01");
  assert.equal(result.products.length, 1);
  assert.equal(result.evaluations[0].withinBudget, null);
  const noStyle = querySampleProducts({ ...demand, styleTags: ["不存在的风格"] }, "S01");
  assert.equal(noStyle.status, "no_known_match_in_samples");
  const pair = querySampleProducts({ ...demand, styleTags: [] }, "S02");
  assert.equal(pair.products.length, 0);
});

test("fixture does not invent inventory, return terms or database IDs", () => {
  const result = querySampleProducts(demand, "S01");
  for (const p of [result.currentProduct!, ...result.evaluations.map((r) => r.product)]) {
    assert.equal(p.stock, null);
    assert.equal(p.returnPolicy, null);
    assert.equal(p.fitVerified, false);
    assert.equal("id" in p, false);
  }
});

test("invalid JSON structure is rejected instead of becoming an unfiltered query", () => {
  for (const invalid of [
    { ...demand, q: undefined }, { ...demand, budgetCents: "50000" },
    { ...demand, budgetCents: -1 }, { ...demand, budgetCents: null },
    { ...demand, budgetCents: 500.5 }, { ...demand, includeCurrentProduct: "true" },
    { ...demand, unexpected: true },
  ]) assert.equal(sampleRequirementsSchema.safeParse(invalid).success, false);
});

test("sample route requires auth, validates requests, and is disabled in production", async () => {
  const environment: Record<string, string | undefined> = process.env;
  const previousMode = environment.NODE_ENV;
  const previousToken = environment.ASSISTANT_TOOL_TOKEN;
  try {
    environment.NODE_ENV = "test";
    environment.ASSISTANT_TOOL_TOKEN = "local-fixture-test-token";
    const url = new URL("http://localhost/api/assistant/sample-products");
    url.searchParams.set("anchorSampleId", "S01");
    url.searchParams.set("requirements", JSON.stringify({ ...demand, budgetCents: 50000 }));
    assert.equal((await GET(new Request(url))).status, 401);
    const headers = { "x-assistant-token": "local-fixture-test-token" };
    const response = await GET(new Request(url, { headers }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "over_budget");
    assert.equal(body.evaluations.find((p: { product: { sampleId: string } }) => p.product.sampleId === "S03").differenceCents, -5600);
    url.searchParams.set("requirements", "{}");
    assert.equal((await GET(new Request(url, { headers }))).status, 400);
    environment.NODE_ENV = "production";
    assert.equal((await GET(new Request(url, { headers }))).status, 404);
  } finally {
    if (previousMode === undefined) delete environment.NODE_ENV;
    else environment.NODE_ENV = previousMode;
    if (previousToken === undefined) delete environment.ASSISTANT_TOOL_TOKEN;
    else environment.ASSISTANT_TOOL_TOKEN = previousToken;
  }
});
