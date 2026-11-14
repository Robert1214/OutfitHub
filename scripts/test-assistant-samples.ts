import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
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

test("two explicit candidate categories request selection, not missing categories or budget", () => {
  const result = querySampleProducts({
    ...demand, q: "滚石T恤 摇滚裤子", intent: "search", category: "",
    requestedCategories: ["tops", "bottoms"], budgetCents: 50000,
  }, "S01");
  assert.equal(result.status, "needs_selection");
  assert.deepEqual(result.clarification, []);
  assert.equal(result.currentProduct, null);
  assert.deepEqual(result.products, []);
  assert.deepEqual(result.evaluations, []);
  assert.deepEqual(result.selection?.requestedCategories, ["tops", "bottoms"]);
  assert.equal(result.selection?.anchorCandidate?.sampleId, "S01");
  assert.equal(result.selection?.anchorConfirmed, false);
  assert.equal(result.requirements.budgetCents, 50000);
  assert.equal(result.requirements.budgetScope, "total");
  assert.deepEqual(result.requirements.otherRequirements, ["不要鞋"]);
});

test("selection preserves real unknowns and never invents an anchor from a different category", () => {
  const multi = {
    ...demand, intent: "search" as const, category: "" as const,
    requestedCategories: ["outerwear", "bottoms"] as ("outerwear" | "bottoms")[],
    includeCurrentProduct: null,
  };
  const result = querySampleProducts(multi, "S01");
  assert.equal(result.status, "needs_selection");
  assert.equal(result.selection?.anchorCandidate, null);
  const noAnchor = querySampleProducts({ ...multi, requestedCategories: ["tops", "bottoms"] }, "");
  assert.equal(noAnchor.status, "needs_selection");
  assert.equal(noAnchor.selection?.anchorCandidate, null);
  const unknown = querySampleProducts({ ...multi, budgetScope: "unknown", missingInformation: ["需要明确的使用场合"] }, "S01");
  assert.equal(unknown.status, "needs_clarification");
  assert.deepEqual(unknown.clarification, ["需要明确的使用场合", "预算是单件还是合计"]);
  assert.deepEqual(unknown.products, []);
});

test("after selecting an anchor, remaining category resumes existing budget checks", () => {
  for (const budgetCents of [50000, 60000]) {
    const result = querySampleProducts({ ...demand, requestedCategories: ["bottoms"], budgetCents }, "S01");
    assert.equal(result.currentProduct?.sampleId, "S01");
    assert.equal(result.currentProductSource, "internal_sample_anchor");
    assert.equal(result.selection, null);
    assert.equal(result.status, budgetCents === 50000 ? "over_budget" : "matched_known_constraints");
    assert.deepEqual(result.products.map((p) => p.sampleId), budgetCents === 50000 ? [] : ["S03"]);
    assert.equal(result.evaluations.find((p) => p.product.sampleId === "S03")?.assessedPriceCents, 55600);
    assert.deepEqual(result.requirements.otherRequirements, ["不要鞋"]);
  }
  const unknown = querySampleProducts({ ...demand, category: "", requestedCategories: [] }, "S01");
  assert.equal(unknown.status, "needs_clarification");
  assert.equal(unknown.selection, null);
});

test("an unknown category never exposes the fixed fixture as the current product", () => {
  const reported = {
    q: "衣服", intent: "search" as const, category: "" as const, requestedCategories: [],
    styleTags: [], budgetCents: 50000, budgetScope: "item" as const,
    includeCurrentProduct: null, otherRequirements: [], missingInformation: ["服装品类"],
  };
  for (const input of [
    reported,
    { ...reported, requestedCategories: undefined },
    { ...reported, intent: "outfit" as const, includeCurrentProduct: true },
  ]) {
    const result = querySampleProducts(input, "S01");
    assert.equal(result.status, "needs_clarification");
    assert.equal(result.currentProduct, null);
    assert.equal(result.currentProductSource, null);
    assert.deepEqual(result.products, []);
    assert.deepEqual(result.evaluations, []);
    assert.equal(result.selection, null);
    assert.ok(result.clarification.some((item) => item.includes("品类") || item.includes("哪一类")));
    assert.equal(JSON.stringify(result).includes("巡演"), false);
    assert.equal(result.requirements.budgetCents, 50000);
  }
});

test("independent searches do not inherit or exclude a configured outfit anchor", () => {
  const search = {
    ...demand, q: "摇滚T恤", intent: "search" as const, category: "tops" as const,
    requestedCategories: ["tops" as const], budgetScope: "item" as const,
    includeCurrentProduct: null, budgetCents: 50000,
  };
  const withoutAnchor = querySampleProducts(search, "");
  const withFixedAnchor = querySampleProducts(search, "S01");
  assert.equal(withFixedAnchor.currentProduct, null);
  assert.equal(withFixedAnchor.currentProductSource, null);
  assert.equal(withFixedAnchor.status, "matched_known_constraints");
  assert.deepEqual(withFixedAnchor.products, withoutAnchor.products);
  assert.deepEqual(withFixedAnchor.products.map((product) => product.sampleId), ["S01"]);
  assert.ok(withFixedAnchor.evaluations.every((item) => item.assessedPriceCents === item.product.priceCents));
});

test("category lists reject invalid or contradictory data instead of silently changing intent", () => {
  for (const requestedCategories of [["tops", "bottoms"], [], ["bottoms", "bottoms"], ["unknown"], "bottoms"]) {
    assert.equal(sampleRequirementsSchema.safeParse({ ...demand, requestedCategories }).success, false);
  }
  assert.equal(sampleRequirementsSchema.safeParse({ ...demand, requestedCategories: ["bottoms"] }).success, true);
  assert.equal(sampleRequirementsSchema.safeParse({ ...demand, category: "", requestedCategories: ["tops", "bottoms"] }).success, true);
  assert.equal(sampleRequirementsSchema.safeParse(demand).success, true);
});

test("the copyable Dify parser preserves category lists and rejects inconsistent or malformed input", () => {
  const source = readFileSync(new URL("./dify-parse-requirements.js", import.meta.url), "utf8");
  const parse = runInNewContext(`${source}\nmain`) as (args: { text: string }) => { requirements: string; q: string };
  const multiple = { ...demand, category: "", intent: "search", requestedCategories: ["tops", "bottoms"] };
  const reported = {
    ...multiple, q: "滚石T恤 摇滚裤子", styleTags: ["摇滚"], budgetCents: 50000,
    budgetScope: "unknown", includeCurrentProduct: null, missingInformation: ["预算范围（单件或合计）"],
  };
  for (const input of [demand, multiple, reported, { ...demand, requestedCategories: ["bottoms"] }]) {
    const parsed = JSON.parse(parse({ text: JSON.stringify(input) }).requirements);
    assert.deepEqual(parsed, input);
    assert.equal(sampleRequirementsSchema.safeParse(parsed).success, true);
  }
  for (const requestedCategories of [["tops", "bottoms"], null, ["shoes", "shoes"], ["unknown"]]) {
    assert.throws(() => parse({ text: JSON.stringify({ ...demand, requestedCategories }) }));
  }
  for (const text of ["not JSON", "null", "[]", JSON.stringify({ ...demand, budgetCents: "50000" })]) {
    assert.throws(() => parse({ text }));
  }
  assert.throws(() => parse({ text: JSON.stringify({ ...multiple, inventedField: "value" }) }),
    /需求提取包含未约定字段：inventedField/);
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
    url.searchParams.set("requirements", JSON.stringify({
      ...demand, q: "衣服", intent: "search", category: "", requestedCategories: [],
      styleTags: [], budgetCents: 50000, budgetScope: "item", includeCurrentProduct: null,
      otherRequirements: [], missingInformation: ["服装品类"],
    }));
    const clarificationResponse = await GET(new Request(url, { headers }));
    assert.equal(clarificationResponse.status, 200);
    const clarificationBody = await clarificationResponse.json();
    assert.equal(clarificationBody.status, "needs_clarification");
    assert.equal(clarificationBody.currentProduct, null);
    assert.deepEqual(clarificationBody.evaluations, []);
    assert.deepEqual(clarificationBody.products, []);
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
