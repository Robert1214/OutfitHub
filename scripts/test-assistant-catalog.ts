import assert from "node:assert/strict";
import { after, test } from "node:test";
import { prisma } from "../src/lib/db";
import { GET } from "../src/app/api/assistant/products/route";
import { GET as getCards } from "../src/app/api/products/route";
import { queryCatalogProducts, type CatalogReader } from "../src/lib/assistant-catalog";
import { hasNoStylePreference, type AssistantRequirements } from "../src/lib/assistant-requirements";

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

test("顾客说「风格无所谓」时不再追问风格，同类在售商品作为备选而不是「最接近」", async () => {
  // 2026-11-16：风格要求只在顾客自己说无所谓/随便/不挑时才放弃；否定搭配不算。
  for (const q of ["找件上衣，预算300，风格无所谓", "随便找条裤子", "裤子都行，不挑", "款式随意，预算300"]) {
    assert.equal(hasNoStylePreference(q), true, q);
  }
  for (const q of ["找条极简裤子", "不想要休闲风", "不要花哨的款式", "风格要通勤"]) {
    assert.equal(hasNoStylePreference(q), false, q);
  }
  // 缺品类时只澄清品类，并告诉模型别再问风格；缺数据时不描述商品。
  const clarifying = await queryCatalogProducts({ ...demand, q: "随便找件衣服", category: "", requestedCategories: [], styleTags: [] }, neverRead);
  assert.equal(clarifying.status, "needs_clarification");
  assert.equal("noStylePreference" in clarifying && clarifying.noStylePreference, true);
  assert.deepEqual(clarifying.products, []);
  // 条件齐全但顾客说风格无所谓：给出售卡片（catalog-nearest），并标成备选替换而不是「最接近」。
  const matched = await queryCatalogProducts({ ...demand, q: "找条裤子，预算400，风格无所谓", styleTags: [] }, prisma.product);
  assert.ok(["matched_known_constraints", "no_match_for_query"].includes(matched.status));
  if (matched.status === "no_match_for_query") {
    assert.ok(matched.nearest.length > 0);
    assert.ok(matched.nearest.some((item) => item.violations.length === 0));
    assert.ok(matched.nearest.every((item) => item.alternativesRecommended === true));
  }
// 非下装搭配：没有风格差异时 nearest 里不应出现「风格不符」，而是备选。
  const outfit = await queryCatalogProducts({ ...demand, q: "这条裙子配什么鞋，风格无所谓", category: "shoes", requestedCategories: ["shoes"], intent: "outfit", styleTags: [] }, prisma.product);
  assert.ok(["unsupported_request", "needs_clarification", "matched_known_constraints"].includes(outfit.status));
});

test("商品标了「显瘦」就按标签算满足，只有体型等仍未核实", async () => {
  // 2026-11-16 用户决定：「显瘦」等在商品标签里标了就算可核实。
  const result = await queryCatalogProducts({ ...demand, q: "显瘦裤子", styleTags: [], budgetCents: 30000,
    otherRequirements: ["显瘦", "梨形身材", "160斤"] }, prisma.product);
  assert.equal(result.status, "needs_verification");
  assert.deepEqual(result.unresolvedRequirements, ["梨形身材", "160斤"]);
  const pants = result.nearest.find((item) => item.product.slug === "black-wide-leg-pants");
  assert.ok(pants, "black-wide-leg-pants should be the nearest item");
  assert.ok(pants.satisfied.some((text) => text.includes("显瘦")), JSON.stringify(pants.satisfied));
  assert.ok(!pants.violations.some((v) => v.text === "显瘦"));
  assert.ok(pants.violations.some((v) => v.field === "budget"));
});

test("unsupported tasks and unverified constraints cannot fall through to generic matches", async () => {
  for (const intent of ["similar", "product_info", "color_advice", "unknown"] as const) {
    const result = await queryCatalogProducts({ ...demand, intent }, neverRead);
    assert.equal(result.status, "unsupported_request");
    // 2026-11-16：非下装搭配改为按顾客条件给 nearest（未传入 reader 时不查库），
    // 正常搜索（search）也不应落进通用匹配。
    assert.equal(result.nearest.length, 0);
  }
  assert.equal((await queryCatalogProducts({ ...demand, category: "", requestedCategories: ["tops", "bottoms"] }, neverRead)).status, "unsupported_request");
  // 2026-11-16：有未核实条件时不再直接返回空结果，而是走 D01-1 给「最接近」；
  // 这里用真实库验证「未核实条件保留、不当作已满足」，并且仍给出候选。
  const result = await queryCatalogProducts({ ...demand, otherRequirements: ["不要鞋", "必须适合我的腰围"] }, prisma.product);
  assert.equal(result.status, "needs_verification");
  assert.deepEqual(result.unresolvedRequirements, ["必须适合我的腰围"]);
  assert.ok(result.nearest.length > 0);
  assert.ok(result.nearest.every((item) => item.violations.some((v) => v.field === "unverified")));
});

test("real catalog price boundary, below-budget result and zero/no budget are distinct", async () => {
  const pants = await prisma.product.findUniqueOrThrow({ where: { slug: "black-wide-leg-pants" } });
  assert.equal(pants.status, "ON_SALE");
  assert.ok(pants.stock > 0);
  for (const budgetCents of [pants.priceCents, pants.priceCents - 1, 0, null]) {
    const result = await queryCatalogProducts({ ...demand, q: pants.name, budgetCents, budgetScope: budgetCents === null ? "none" : "item" }, prisma.product);
    const affordable = budgetCents === null || budgetCents >= pants.priceCents;
    assert.equal(result.status, affordable ? "matched_known_constraints" : "over_budget");
    if (!affordable) assert.deepEqual(result.nearest[0].violations.map((v) => v.field), ["budget"]);
    if (affordable) {
      // matched：从 products 推荐；nearest 不重复给，否则同一件会被点两次名。
      assert.deepEqual(result.nearest, []);
      assert.deepEqual(result.products.map((p) => p.id), [pants.id]);
    } else {
      // D01-1: over budget still names the nearest item; the rule forbids recommending it.
      assert.deepEqual(result.nearest.map((item) => item.product.id), [pants.id]);
      assert.deepEqual(result.products, []);
    }
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
    // 2026-11-16：没有完全匹配时仍给出「最接近」并标出违反项（D01-1）。
    assert.deepEqual(unmatched.products, []);
    assert.ok(unmatched.nearest.length > 0);
    // 至少一件要标出差在哪；完全无差异的那件只有在没有更接近的候选时才会出现。
    assert.ok(unmatched.nearest.some((item) => item.violations.length > 0));
  }
});

test("matching stock query excludes sold items and sorts affordable candidates before limiting", async () => {
  const tops = await queryCatalogProducts({ ...demand, q: "极简上衣", category: "tops", requestedCategories: ["tops"], otherRequirements: [] }, prisma.product, 1);
  assert.equal(tops.products.length, 1);
  assert.deepEqual(tops.nearest, []);
  assert.equal(tops.products[0].slug, "grey-knit-vest");
  const sold = await queryCatalogProducts({ ...demand, q: "复古乐福鞋", category: "shoes", requestedCategories: ["shoes"], styleTags: ["复古"], budgetCents: null, budgetScope: "none", otherRequirements: [] }, prisma.product);
  assert.equal(sold.status, "no_match_for_query");
  assert.deepEqual(sold.products, []);
});

test("非下装搭配按顾客条件筛候选；筛不到退回同品类在售并标出违反项", async () => {
  const winter = await queryCatalogProducts({ ...demand, intent: "outfit", category: "shoes", requestedCategories: ["shoes"], styleTags: [], otherRequirements: ["冬天"] }, prisma.product);
  assert.equal(winter.status, "unsupported_request");
  const sneakers = winter.nearest.find((item) => item.product.slug === "white-sneakers");
  assert.ok(sneakers, "筛不到时仍要给出在售鞋款");
  assert.ok(!winter.nearest.some((item) => item.product.slug === "retro-loafers"), "售罄款不进候选");
  const office = await queryCatalogProducts({ ...demand, intent: "outfit", category: "shoes", requestedCategories: ["shoes"], styleTags: ["中性"], otherRequirements: ["通勤"] }, prisma.product);
  assert.equal(office.status, "unsupported_request");
  assert.ok(office.nearest.length > 0 && office.nearest.every((item) => item.violations.length === 0), "条件能筛到时不应带违反项");
});

test("卡片规则由工具给出：有 nearest 才要求打标，澄清与空结果不打标", async () => {
  const noMatch = await GET(request({ ...demand, q: "复古裤子", styleTags: ["复古"] }));
  assert.equal((await noMatch.json()).cardPolicy.mode, "name-once");
  const clarify = await GET(request({ ...demand, category: "", requestedCategories: [], styleTags: [] }));
  assert.equal((await clarify.json()).cardPolicy.mode, "none");
  const matched = await GET(request(demand));
  assert.equal((await matched.json()).cardPolicy.mode, "products");
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
