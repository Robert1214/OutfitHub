// Compare observed same-run fields with predeclared expectations, without LLM calls.
// Human semantic review remains separate from these mechanical checks.
import fs from "node:fs";
import path from "node:path";
import { resolveRun } from "./eval-baseline-paths.mjs";

const { root, dir } = resolveRun(process.argv[2]);
const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const rows = read(path.join(dir, "results.json")).results;
const traces = read(path.join(dir, "workflow-traces.json")).rows;
const catalog = read(path.join(root, "catalog.json")).products;
const fixture = read(path.join(root, "memory-bank/m5-current-scope-eval.json"));
const stable = (value) => JSON.stringify(value, (_, v) => v && typeof v === "object" && !Array.isArray(v)
  ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const same = (a, b) => stable(a) === stable(b);
const sorted = (a) => [...a].sort();
const statistics = (values) => {
  const a = sorted(values).sort((x, y) => x - y);
  return { min: a[0], median: a[Math.floor(a.length / 2)], max: a.at(-1), sum: a.reduce((s, n) => s + n, 0) };
};
const observations = rows.map((r) => {
  const traceRow = traces.find((t) => t.key === r.key);
  if (traceRow?.matches.length !== 1) throw new Error(`Ambiguous trace: ${r.key}`);
  const t = traceRow.matches[0];
  if (t.conversationId !== r.conversationId || t.query !== r.request.query) throw new Error("Trace does not match request");
  const node = (type) => t.nodes.find((n) => n.type === type);
  const extraction = JSON.parse(t.nodes.find((n) => n.nodeId === "1793705786188").extractionText);
  const req = JSON.parse(node("code").requirementsText);
  const body = JSON.parse(node("http-request").httpBody);
  const e = r.expected;
  const failures = [];
  const check = (name, actual, expected) => { if (!same(actual, expected)) failures.push({ name, actual, expected }); };
  check("workflowStatus", t.workflowStatus, "succeeded");
  check("httpStatus", node("http-request").httpStatus, 200);
  check("extractionToParser", req, extraction);
  check("parserToHttp", body.requirements, req);
  for (const k of ["intent", "category", "budgetCents", "budgetScope", "includeCurrentProduct", "anchorProductId"]) {
    if (Object.hasOwn(e, k)) check(k, req[k], e[k]);
  }
  if (e.style) check("style", req.styleTags.some((s) => s.replace(/风$/, "") === e.style), true);
  if (e.excludeShoes) check("excludeShoes", req.otherRequirements.includes("不要鞋"), true);
  if (e.preserveRequirement) check("preserveRequirement", req.otherRequirements.some((s) => s.includes(e.preserveRequirement)), true);
  if (e.anchorMatchesPage) check("anchorMatchesPage", req.anchorProductId, catalog.find((p) => p.slug === r.request.productSlug).id);
  if (e.currentProductIsNull) check("currentProductIsNull", body.currentProduct, null);
  check("status", body.status, e.status);
  const expectedIds = e.productSlugs.map((slug) => catalog.find((p) => p.slug === slug).id);
  check("toolProductIds", sorted(body.products.map((p) => p.id)), sorted(expectedIds));
  for (const k of ["minimumPriceCents", "overByCents"]) {
    if (Object.hasOwn(e, k)) check(k, body.budgetAssessment?.[k], e[k]);
  }
  for (const k of ["outfitTotalCents", "assessedPriceCents", "budgetRemainderCents"]) {
    if (Object.hasOwn(e, k)) check(k, body.outfits?.[0]?.[k], e[k]);
  }
  if (e.priceCents) check("productPrices", body.products.map((p) => p.priceCents), [e.priceCents]);
  const usedIdAllowed = r.productIds.every((id) => body.products.some((p) => p.id === id));
  check("markersOnlyFromCurrentTool", usedIdAllowed, true);
  return { key: r.key, query: r.request.query, requirements: req, toolStatus: body.status,
    unresolvedRequirements: body.unresolvedRequirements || [], technical: r.checks.technical,
    markerExpectation: r.checks.productMarkers, cardFacts: r.checks.cardFacts,
    sameRunTransport: same(req, extraction) && same(req, body.requirements),
    toolProductIds: body.products.map((p) => p.id), structuredChecks: failures.length ? "failed" : "passed",
    failures, workflowSteps: t.totalSteps, answer: r.answer,
    semanticGrade: "requires_manual_review", firstDeltaMs: r.firstDeltaMs, latencyMs: r.latencyMs };
});
const runTraces = traces.flatMap((r) => r.matches);
const nodes = runTraces.flatMap((t) => t.nodes);
const models = nodes.filter((n) => n.usage);
const cases = fixture.cases.map((c) => ({ id: c.id, completionEligible: c.completionEligible,
  turnKeys: observations.filter((r) => r.key.startsWith(c.id + "-")).map((r) => r.key) }));
const summary = { generatedAt: new Date().toISOString(), grading: "mechanical_checks_only_semantic_review_separate",
  observations, cases, metrics: {
    turns: observations.length, technicalPassed: observations.filter((r) => r.technical === "passed").length,
    structuredPassed: observations.filter((r) => r.structuredChecks === "passed").length,
    transportPassed: observations.filter((r) => r.sameRunTransport).length,
    markerExpectationPassed: observations.filter((r) => r.markerExpectation === "passed").length,
    cardsChecked: observations.filter((r) => r.cardFacts !== "not_applicable").length,
    cardFactsPassed: observations.filter((r) => r.cardFacts === "passed").length,
    firstDeltaMs: statistics(rows.map((r) => r.firstDeltaMs)), latencyMs: statistics(rows.map((r) => r.latencyMs)),
    modelCalls: models.length, workflowTotalTokens: runTraces.reduce((s, t) => s + t.totalTokens, 0),
    modelSecondsTotal: models.reduce((s, n) => s + n.seconds, 0),
    httpSeconds: statistics(nodes.filter((n) => n.type === "http-request").map((n) => n.seconds)),
    workflowSeconds: statistics(runTraces.map((t) => t.workflowSeconds)),
    difyReportedPriceAllZero: models.every((n) => Number(n.usage.total_price) === 0),
    configuredUnitPricesAllZero: models.every((n) => Number(n.usage.prompt_unit_price) === 0 && Number(n.usage.completion_unit_price) === 0),
    actualProviderCost: null,
  } };
fs.writeFileSync(path.join(dir, "structured-review.json"), JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify(summary.metrics, null, 2));
console.log(JSON.stringify({ failures: observations.filter((r) => r.failures.length).map((r) => ({ key: r.key, failures: r.failures })) }, null, 2));
