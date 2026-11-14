// 比较功能接入的本地验证（不连 Dify、不查数据库商品）。
// 运行：node --env-file=.env --import tsx scripts/test-assistant-comparisons.ts
// 覆盖：共享 schema 与 Dify 代码执行脚本接受 intent=comparison；
// 比较资料与单节点验证 fixture 同形；路由返回该资料且不触碰数据库；
// 旧 intent 不受影响；非法 requirements 仍 fail-closed（400）。

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { GET } from "../src/app/api/assistant/products/route";
import { assistantRequirementsSchema } from "../src/lib/assistant-requirements";
import { ownerReviewedComparisonCatalog } from "../src/lib/assistant-comparisons";

// 提取提示词第13条定义的 comparison 字段取值：除 intent 外全部为空/默认。
const comparisonDemand = {
  q: "",
  intent: "comparison",
  category: "",
  requestedCategories: [] as string[],
  styleTags: [] as string[],
  budgetCents: null,
  budgetScope: "none",
  includeCurrentProduct: null,
  anchorProductId: null,
  otherRequirements: [] as string[],
  missingInformation: [] as string[],
};

const loadDifyParser = () =>
  runInNewContext(readFileSync("scripts/dify-parse-requirements.js", "utf8") + "; main;");

test("comparison requirements pass the shared schema and the Dify code-node parser", () => {
  const parsed = assistantRequirementsSchema.parse(comparisonDemand);
  assert.equal(parsed.intent, "comparison");
  assert.equal(parsed.q, "");
  assert.equal(parsed.budgetScope, "none");
  assert.equal(parsed.budgetCents, null);

  const parse = loadDifyParser();
  const out = parse({ text: JSON.stringify(comparisonDemand) });
  assert.equal(out.q, "");
  assert.equal(out.category, "");
  assert.equal(out.styleTags, "");
  const roundTrip = assistantRequirementsSchema.parse(JSON.parse(out.requirements));
  assert.deepEqual(roundTrip, comparisonDemand);
});

test("legacy search/outfit intents still parse; unknown intents still rejected", () => {
  const legacy = {
    q: "极简裤子",
    intent: "outfit",
    category: "bottoms",
    requestedCategories: ["bottoms"],
    styleTags: ["极简"],
    budgetCents: 80000,
    budgetScope: "total",
    includeCurrentProduct: true,
    anchorProductId: "real-page-id",
    otherRequirements: ["不要鞋", "通勤"],
    missingInformation: [],
  };
  const parse = loadDifyParser();
  const roundTrip = assistantRequirementsSchema.parse(
    JSON.parse(parse({ text: JSON.stringify(legacy) }).requirements),
  );
  assert.deepEqual(roundTrip, legacy);
  assert.throws(
    () => parse({ text: JSON.stringify({ ...legacy, intent: "comparisonn" }) }),
    /intent/,
  );
});

test("comparison catalog mirrors the reviewed fixture with production provenance", () => {
  const catalog = ownerReviewedComparisonCatalog;
  assert.equal(catalog.scope, "internal_style_comparison");
  assert.equal(catalog.comparisonOnly, true);
  assert.equal(catalog.purchaseScope, "undecided");
  assert.equal(catalog.provenance, "owner_reviewed_comparison_catalog");
  assert.equal(catalog.currentProduct, null);

  const sampleIds = catalog.items.map((i) => i.sampleId).sort();
  assert.deepEqual(sampleIds, ["S02", "S04", "S05"]);
  const noRealIds = catalog.items.every(
    (i) => !("id" in i) && !("slug" in i) && !("purchaseUrl" in i),
  );
  assert.ok(noRealIds, "比较资料不得包含数据库商品ID或购买链接");

  // 与 brief 核对：S04 45800 + S02 36800 = 82600；S05 48800 + S02 36800 = 85600。
  const prices = Object.fromEntries(catalog.items.map((i) => [i.sampleId, i.priceCents]));
  const options = catalog.comparisonOptions;
  assert.deepEqual(options.map((o) => o.label), ["A", "B"]);
  for (const o of options) {
    assert.ok(o.itemSampleIds.includes("S02"));
    assert.equal(
      o.listedItemsSubtotalCents,
      o.itemSampleIds.reduce((sum, id) => sum + prices[id], 0),
    );
    assert.equal(o.purchaseTotalCents, null);
  }

  const text = JSON.stringify(catalog);
  assert.equal(text.includes("[[PRODUCTS"), false);
});

test("comparison intent returns the reviewed catalog body without touching the database", async () => {
  const token = process.env.ASSISTANT_TOOL_TOKEN?.trim();
  assert.ok(token, "ASSISTANT_TOOL_TOKEN 未设置，无法运行路由测试");
  const url = new URL("http://localhost/api/assistant/products");
  url.searchParams.set("requirements", JSON.stringify(comparisonDemand));
  const response = await GET(new Request(url, { headers: { "x-assistant-token": token } }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.scope, "internal_style_comparison");
  assert.equal(body.comparisonOnly, true);
  assert.equal(body.provenance, "owner_reviewed_comparison_catalog");
  assert.deepEqual(
    body.comparisonOptions.map((o: { label: string }) => o.label),
    ["A", "B"],
  );
});

test("malformed requirements still fail closed with 400 instead of searching", async () => {
  const token = process.env.ASSISTANT_TOOL_TOKEN?.trim();
  assert.ok(token, "ASSISTANT_TOOL_TOKEN 未设置，无法运行路由测试");
  const url = new URL("http://localhost/api/assistant/products");
  url.searchParams.set("requirements", "{not valid json");
  const response = await GET(new Request(url, { headers: { "x-assistant-token": token } }));
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.ok(typeof body.error === "string" && body.error.length > 0);
});
