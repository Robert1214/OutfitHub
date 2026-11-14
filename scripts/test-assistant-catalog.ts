import assert from "node:assert/strict";
import { after, test } from "node:test";
import { prisma } from "../src/lib/db";
import { GET } from "../src/app/api/assistant/products/route";
import { GET as getCards } from "../src/app/api/products/route";
import { queryCatalogProducts, type CatalogReader } from "../src/lib/assistant-catalog";
import type { AssistantRequirements } from "../src/lib/assistant-requirements";

// Read-only integration checks against the existing local demo catalog; no seed,
// insert, update or deletion. Resolve identities from stored slugs, never invent IDs.
after(async () => { await prisma.$disconnect(); });
const demand: AssistantRequirements = {
  q: "极简裤子", intent: "search", category: "bottoms", requestedCategories: ["bottoms"],
  styleTags: ["极简"], budgetCents: 40000, budgetScope: "item", includeCurrentProduct: null,
  otherRequirements: ["不要鞋"], missingInformation: [],
};
const neverRead: CatalogReader = { async findMany() { throw new Error("must not query catalog"); } };
const toolToken = process.env.ASSISTANT_TOOL_TOKEN?.trim();
assert.ok(toolToken, "local tool credential is required; value is never printed");

function request(requirements: unknown, extras: Record<string, string> = {}, authorized = true) {
  const url = new URL("http://localhost/api/assistant/products");
  url.searchParams.set("requirements", typeof requirements === "string" ? requirements : JSON.stringify(requirements));
  for (const [name, value] of Object.entries(extras)) url.searchParams.set(name, value);
  return new Request(url, { headers: authorized ? { "x-assistant-token": toolToken! } : {} });
}

test("unknown category, unknown scope and conflicting exclusions ask before querying", async () => {
  for (const requirements of [
    { ...demand, q: "衣服", category: "" as const, requestedCategories: [], styleTags: [] },
    { ...demand, budgetScope: "unknown" as const },
    { ...demand, budgetScope: "total" as const },
    { ...demand, otherRequirements: ["不要裤子"] },
  ]) {
    const result = await queryCatalogProducts(requirements, neverRead);
    assert.equal(result.status, "needs_clarification");
    assert.equal(result.currentProduct, null);
    assert.deepEqual(result.products, []);
    assert.ok(result.clarification.length > 0);
  }
});

test("unsupported tasks and unverified constraints cannot fall through to generic matches", async () => {
  for (const intent of ["outfit", "similar", "product_info", "color_advice", "unknown"] as const) {
    const result = await queryCatalogProducts({ ...demand, intent }, neverRead);
    assert.equal(result.status, "unsupported_request");
    assert.deepEqual(result.products, []);
  }
  assert.equal((await queryCatalogProducts({ ...demand, category: "", requestedCategories: ["tops", "bottoms"] }, neverRead)).status, "unsupported_request");
  const result = await queryCatalogProducts({ ...demand, otherRequirements: ["不要鞋", "必须适合我的腰围"] }, neverRead);
  assert.equal(result.status, "needs_verification");
  assert.deepEqual(result.unresolvedRequirements, ["必须适合我的腰围"]);
  assert.deepEqual(result.products, []);
});

test("real catalog price boundary, below-budget result and zero/no budget are distinct", async () => {
  const pants = await prisma.product.findUniqueOrThrow({ where: { slug: "black-wide-leg-pants" } });
  assert.equal(pants.status, "ON_SALE");
  assert.ok(pants.stock > 0);
  for (const budgetCents of [pants.priceCents, pants.priceCents - 1, 0, null]) {
    const result = await queryCatalogProducts({ ...demand, q: pants.name, budgetCents, budgetScope: budgetCents === null ? "none" : "item" }, prisma.product);
    const affordable = budgetCents === null || budgetCents >= pants.priceCents;
    assert.equal(result.status, affordable ? "matched_known_constraints" : "over_budget");
    assert.deepEqual(result.products.map((p) => p.id), affordable ? [pants.id] : []);
    if (!affordable) assert.deepEqual(result.budgetAssessment, { minimumPriceCents: pants.priceCents, budgetCents, overByCents: pants.priceCents - budgetCents! });
  }
});

test("explicit category, all styles, garment type and unknown keywords remain constraints", async () => {
  const result = await queryCatalogProducts(demand, prisma.product);
  assert.equal(result.status, "matched_known_constraints");
  assert.ok(result.products.length > 0);
  assert.ok(result.products.every((p) => p.categorySlug === "bottoms" && p.name.includes("裤") && p.styleTags.includes("极简") && p.priceCents <= 40000 && p.stock > 0));
  for (const styleTags of [["极简"], ["极简风"]]) {
    const alias = await queryCatalogProducts({ ...demand, q: "极简风裤子", styleTags }, prisma.product);
    assert.deepEqual(alias.products.map((p) => p.id), result.products.map((p) => p.id));
  }
  for (const change of [
    { styleTags: ["极简", "不存在风格"] },
    { q: "不存在品牌裤子" },
    { q: "复古裤子", styleTags: ["复古"] }, // The available retro bottom is a skirt.
  ]) {
    const unmatched = await queryCatalogProducts({ ...demand, ...change }, prisma.product);
    assert.equal(unmatched.status, "no_match_for_query");
    assert.deepEqual(unmatched.products, []);
  }
});

test("matching stock query excludes sold items and sorts affordable candidates before limiting", async () => {
  const tops = await queryCatalogProducts({ ...demand, q: "极简上衣", category: "tops", requestedCategories: ["tops"], otherRequirements: [] }, prisma.product, 1);
  assert.equal(tops.products.length, 1);
  assert.equal(tops.products[0].slug, "grey-knit-vest");
  const sold = await queryCatalogProducts({ ...demand, q: "复古乐福鞋", category: "shoes", requestedCategories: ["shoes"], styleTags: ["复古"], budgetCents: null, budgetScope: "none", otherRequirements: [] }, prisma.product);
  assert.equal(sold.status, "no_match_for_query");
  assert.deepEqual(sold.products, []);
});

test("HTTP validates auth, JSON, duplicates and legacy mixed parameters without fallback", async () => {
  assert.equal((await GET(request(demand, {}, false))).status, 401);
  for (const value of ["", "not json", "{}", { ...demand, budgetCents: "40000" }, { ...demand, unexpected: true }]) {
    assert.equal((await GET(request(value))).status, 400);
  }
  const invalidExtras: Record<string, string>[] = [{ q: "鞋" }, { anchorSampleId: "S01" }, { limit: "5" }];
  for (const extras of invalidExtras) {
    assert.equal((await GET(request(demand, extras))).status, 400);
  }
  const duplicate = new URL(request(demand).url);
  duplicate.searchParams.append("requirements", JSON.stringify(demand));
  assert.equal((await GET(new Request(duplicate, { headers: { "x-assistant-token": toolToken! } }))).status, 400);
});

test("new HTTP returns real card IDs and page context cannot become a recommendation", async () => {
  const page = await prisma.product.findUniqueOrThrow({ where: { slug: "white-sneakers" } });
  const response = await GET(request(demand, { limit: "4", contextProductId: page.id }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.json();
  assert.equal(body.scope, "catalog_single_item");
  assert.equal(body.status, "matched_known_constraints");
  assert.equal(body.currentProduct, null);
  assert.ok(body.products.length > 0 && body.products.length <= 4);
  const ids = body.products.map((p: { id: string }) => p.id);
  assert.equal(ids.includes(page.id), false);
  const cardsResponse = await getCards(new Request(`http://localhost/api/products?ids=${encodeURIComponent(ids.join(","))}`));
  const cards = (await cardsResponse.json()).products;
  for (const product of body.products) {
    const card = cards.find((p: { id: string }) => p.id === product.id);
    assert.ok(card);
    assert.equal(card.priceCents, product.priceCents);
    assert.equal(card.slug, product.slug);
    assert.equal(card.imageUrl, product.imageUrl);
  }
});

test("legacy query remains compatible while outfit without a selected page anchor asks first", async () => {
  const legacy = await GET(new Request("http://localhost/api/assistant/products?q=极简裤子&category=bottoms&styleTags=极简&limit=5", { headers: { "x-assistant-token": toolToken! } }));
  assert.equal(legacy.status, 200);
  const legacyBody = await legacy.json();
  assert.ok(legacyBody.products.some((p: { slug: string }) => p.slug === "black-wide-leg-pants"));
  assert.equal(legacyBody.scope, undefined);
  const response = await GET(request({ ...demand, intent: "outfit", budgetScope: "total", includeCurrentProduct: true }));
  const body = await response.json();
  assert.equal(body.status, "needs_clarification");
  assert.equal(body.scope, "catalog_anchored_outfit");
  assert.deepEqual(body.products, []);
});
