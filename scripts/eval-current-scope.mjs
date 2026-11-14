// Run from the repository root. No prompt/data changes and no automatic retries.
// node scripts/eval-current-scope.mjs          validates the frozen inputs only
// node scripts/eval-current-scope.mjs --run    makes 17 calls to the published app
// --snapshot=<directory> selects a separate baseline without overwriting the old run.
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolveSnapshot } from "./eval-baseline-paths.mjs";

const snapshotArgs = process.argv.slice(2).filter((arg) => arg.startsWith("--snapshot="));
if (snapshotArgs.length > 1) throw new Error("Only one snapshot may be selected");
const SNAPSHOT = resolveSnapshot(snapshotArgs[0]?.slice("--snapshot=".length));
const CASE_FILE = "memory-bank/m5-current-scope-eval.json";
const BASE = "http://localhost:3000";
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const saveJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });

export function productMarkers(answer) {
  return [...answer.matchAll(/\[\[PRODUCTS:([^\]]+)\]\]/gi)]
    .flatMap((match) => match[1].split(",").map((id) => id.trim()).filter(Boolean));
}

export async function readChatStream(response, startedAt) {
  const result = { httpStatus: response.status, answer: "", conversationId: "", done: false,
    errors: [], firstDeltaMs: null, latencyMs: null, malformedLines: 0 };
  if (!response.ok || !response.body) {
    result.errors.push(`http_${response.status}`);
    result.latencyMs = Date.now() - startedAt;
    return result;
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  function line(value) {
    if (!value.trim()) return;
    let event;
    try { event = JSON.parse(value); } catch { result.malformedLines++; return; }
    if (event.type === "delta" && typeof event.text === "string" && event.text) {
      result.firstDeltaMs ??= Date.now() - startedAt;
      result.answer += event.text;
    }
    if (event.type === "done") {
      result.done = true;
      result.conversationId = event.conversationId || "";
      if (event.usage && typeof event.usage === "object") result.usage = event.usage;
    }
    // Do not save arbitrary upstream error bodies, headers, or model reasoning.
    if (event.type === "error") result.errors.push("application_stream_error");
  }
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n")) !== -1) {
        line(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
    }
    buffer += decoder.decode();
    line(buffer);
  } catch { result.errors.push("stream_interrupted"); }
  finally { reader.releaseLock(); }
  if (!result.done) result.errors.push("no_proxy_done_event");
  if (!result.answer.trim()) result.errors.push("empty_answer");
  if (result.malformedLines) result.errors.push("malformed_stream_lines");
  result.latencyMs = Date.now() - startedAt;
  return result;
}

function validateBaseline() {
  const manifest = readJson(path.join(SNAPSHOT, "manifest.json"));
  for (const item of manifest.files) {
    for (const file of [item.path, path.join(SNAPSHOT, item.path)]) {
      if (sha256(fs.readFileSync(file)) !== item.sha256) throw new Error(`Frozen file changed: ${file}`);
    }
  }
  for (const file of [manifest.dify.sourcePath, path.join(SNAPSHOT, manifest.dify.snapshotPath)]) {
    if (sha256(fs.readFileSync(file)) !== manifest.dify.sha256) throw new Error("Dify export changed");
  }
  if (manifest.dify.publication.status !== "user_confirmed_published") throw new Error("Publication not confirmed");
  const catalogFile = path.join(SNAPSHOT, manifest.catalog.path);
  if (sha256(fs.readFileSync(catalogFile)) !== manifest.catalog.sha256) throw new Error("Catalog snapshot changed");
  const fixture = readJson(CASE_FILE);
  const catalog = readJson(catalogFile).products;
  const slugs = new Set(catalog.map((p) => p.slug));
  if (new Set(fixture.cases.map((c) => c.id)).size !== fixture.cases.length) throw new Error("Duplicate cases");
  for (const c of fixture.cases) {
    if (c.contextProductSlug && !slugs.has(c.contextProductSlug)) throw new Error("Unknown context slug");
    for (const t of c.turns) {
      if (!t.query || t.query.length > 500) throw new Error("Invalid query");
      for (const slug of t.expected.productSlugs) if (!slugs.has(slug)) throw new Error("Unknown expected slug");
    }
  }
  return { manifest, fixture, catalog };
}

async function cardsFor(ids) {
  if (!ids.length) return { status: "not_applicable", products: [] };
  try {
    const response = await fetch(`${BASE}/api/products?ids=${encodeURIComponent([...new Set(ids)].join(","))}`,
      { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return { status: "failed", products: [], error: `http_${response.status}` };
    const data = await response.json();
    return { status: "received", products: (data.products || []).map((p) => ({
      id: p.id, slug: p.slug, name: p.name, priceCents: p.priceCents,
      status: p.status, stock: p.stock,
    })) };
  } catch { return { status: "failed", products: [], error: "card_lookup_failed" }; }
}

export function checkCards(ids, cards, expected, catalog) {
  const expectedIds = expected.productSlugs.map((slug) => catalog.find((p) => p.slug === slug).id);
  const sameIds = ids.length === new Set(ids).size &&
    ids.length === expectedIds.length && ids.every((id) => expectedIds.includes(id));
  const cardFacts = cards.status === "not_applicable" ? "not_applicable" :
    cards.status === "received" && cards.products.length === ids.length && ids.every((id) => {
      const actual = cards.products.find((p) => p.id === id);
      const frozen = catalog.find((p) => p.id === id);
      return actual && frozen && ["slug", "name", "priceCents", "status", "stock"].every((key) => actual[key] === frozen[key]);
    }) ? "passed" : "failed";
  return { productMarkers: sameIds ? "passed" : "failed", cardFacts };
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--run" && !arg.startsWith("--snapshot="))) {
    throw new Error("Supported arguments: --run, --snapshot=<directory>");
  }
  const { manifest, fixture, catalog } = validateBaseline();
  const turnCount = fixture.cases.reduce((sum, c) => sum + c.turns.length, 0);
  if (!process.argv.includes("--run")) {
    console.log(JSON.stringify({ stage: "preflight_only", cases: fixture.cases.length, turns: turnCount }));
    return;
  }
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8);
  const dir = path.join(SNAPSHOT, "runs", id);
  fs.mkdirSync(dir, { recursive: true });
  saveJson(path.join(dir, "run.json"), { id, startedAt: new Date().toISOString(), base: BASE,
    cases: fixture.cases.length, plannedTurns: turnCount, automaticRetries: 0,
    channel: "published_website_api", publicationEvidence: manifest.dify.publication,
    baseline: manifest, baselineDirectory: SNAPSHOT,
    runnerSha256: sha256(fs.readFileSync("scripts/eval-current-scope.mjs")),
    limitations: ["Website proxy does not expose requirements or tool status; do not infer them from replies.",
      "Usage and cost are unknown through this endpoint.", "Proxy done does not independently prove the upstream message_end event.",
      "Semantic and factual grading requires review; marker checks alone do not establish task success."] });
  console.log(JSON.stringify({ runDir: dir, plannedTurns: turnCount }));
  const rows = [];
  for (const c of fixture.cases) {
    const anonId = `eval-${randomUUID()}`;
    let conversationId = "";
    let historyAvailable = true;
    for (const [index, turn] of c.turns.entries()) {
      const key = `${c.id}-T${index + 1}`;
      if (!historyAvailable) {
        const skipped = { key, caseId: c.id, query: turn.query, status: "not_run", reason: "previous_turn_no_conversation_id" };
        saveJson(path.join(dir, `${key}.json`), skipped); rows.push(skipped); continue;
      }
      const request = { query: turn.query, anonId,
        ...(conversationId ? { conversationId } : {}),
        ...(c.contextProductSlug ? { productSlug: c.contextProductSlug } : {}) };
      const startedAt = Date.now();
      let result;
      try {
        const response = await fetch(`${BASE}/api/chat`, { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
          signal: AbortSignal.timeout(120000) });
        result = await readChatStream(response, startedAt);
      } catch (error) {
        result = { httpStatus: null, answer: "", conversationId: "", done: false,
          errors: [error.name === "TimeoutError" ? "request_timeout" : "request_failed"],
          firstDeltaMs: null, latencyMs: Date.now() - startedAt };
      }
      const ids = productMarkers(result.answer);
      const cards = await cardsFor(ids);
      const row = { key, caseId: c.id,
        group: manifest.previouslySeenCaseIds?.includes(c.id) ? "regression" : c.group,
        originalGroup: c.group, completionEligible: c.completionEligible,
        startedAt: new Date(startedAt).toISOString(), request, expected: turn.expected,
        ...result, productIds: ids, cards,
        checks: { technical: result.errors.length ? "failed" : "passed", ...checkCards(ids, cards, turn.expected, catalog),
          extraction: "unverified", toolConstraints: "unverified", semanticBehavior: "unverified", factualClaims: "unverified", visual: "unverified" },
        usage: result.usage ?? null, cost: null };
      saveJson(path.join(dir, `${key}.json`), row); rows.push(row);
      console.log(JSON.stringify({ key, technical: row.checks.technical, markers: row.checks.productMarkers, latencyMs: row.latencyMs }));
      conversationId = result.conversationId;
      historyAvailable = Boolean(conversationId);
    }
  }
  saveJson(path.join(dir, "results.json"), { completedAt: new Date().toISOString(), results: rows });
  console.log(JSON.stringify({ completed: true, runDir: dir, rows: rows.length, semanticReviewPending: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
