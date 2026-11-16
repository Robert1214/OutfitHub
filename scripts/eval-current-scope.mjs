// Run from the repository root. No prompt/data changes. Empty answers (upstream
// stream dropped) are retried once on a fresh conversation; set EVAL_AUTO_RETRIES=0 to disable.
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
// Upstream DeepSeek stream occasionally drops before any output; ask once more.
const MAX_AUTO_RETRIES = Number(process.env.EVAL_AUTO_RETRIES ?? 1);
const RETRY_DELAY_MS = Number(process.env.EVAL_RETRY_DELAY_MS ?? 3000);
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
    if (event.type === "error") {
      result.errors.push("application_stream_error");
      // The proxy only forwards a generic Chinese message; a billing failure or a
      // workflow exception looks identical to a dropped network stream here.
      if (/余额|quota|balance|billing/i.test(String(event.message ?? ""))) result.errors.push("quota_exhausted");
      if (/工作流失败|workflow/i.test(String(event.message ?? ""))) result.errors.push("workflow_failed");
    }
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
      for (const slug of t.expected.productSlugs || []) if (!slugs.has(slug)) throw new Error("Unknown expected slug");
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

function checkCards(ids, cards, expected, catalog) {
  const expectedIds = (expected.productSlugs || []).map((slug) => catalog.find((p) => p.slug === slug).id);
  // A turn that refers back to an item already named in this conversation may or may
  // not repeat its card (user decision 2026-11-16: either is fine); the markers it does
  // carry must still be exactly the expected ones, never a different product.
  if (expected.productSlugsOptional) {
    const markerSet = ids.length === new Set(ids).size && ids.every((id) => expectedIds.includes(id));
    return { productMarkers: markerSet ? "passed" : "failed",
      cardFacts: markerSet ? checkCardFacts(ids, cards, catalog) : "not_applicable", optional: true };
  }
  // D01-1 partial results: the nearest items are informational, so order is not
  // meaningful — only the exact set must match the declared candidates.
  const sameIds = ids.length === new Set(ids).size &&
    ids.length === expectedIds.length && ids.every((id) => expectedIds.includes(id));
  return { productMarkers: sameIds ? "passed" : "failed", cardFacts: checkCardFacts(ids, cards, catalog) };
}

function checkCardFacts(ids, cards, catalog) {
  return cards.status === "not_applicable" ? "not_applicable" :
    cards.status === "received" && cards.products.length === ids.length && ids.every((id) => {
      const actual = cards.products.find((p) => p.id === id);
      const frozen = catalog.find((p) => p.id === id);
      return actual && frozen && ["slug", "name", "priceCents", "status", "stock"].every((key) => actual[key] === frozen[key]);
    }) ? "passed" : "failed";
}

async function main() {
  if (process.argv.slice(2).some((arg) => arg !== "--run" && !arg.startsWith("--snapshot="))) {
    throw new Error("Supported arguments: --run, --snapshot=<directory>");
  }
  const { manifest, fixture, catalog } = validateBaseline();
  // User decision 2026-11-16 (Q1=A, widened): from the second turn of a conversation on,
  // the user is following up on what was already shown, so a card is optional there.
  const followUpTurns = new Set(fixture.cases.flatMap((c) => c.turns.slice(1).map((_, i) => `${c.id}-T${i + 2}`)));
  const turnCount = fixture.cases.reduce((sum, c) => sum + c.turns.length, 0);
  if (!process.argv.includes("--run")) {
    console.log(JSON.stringify({ stage: "preflight_only", cases: fixture.cases.length, turns: turnCount }));
    return;
  }
  const id = new Date().toISOString().replace(/[:.]/g, "-") + "-" + randomUUID().slice(0, 8);
  const dir = path.join(SNAPSHOT, "runs", id);
  fs.mkdirSync(dir, { recursive: true });
  saveJson(path.join(dir, "run.json"), { id, startedAt: new Date().toISOString(), base: BASE,
    cases: fixture.cases.length, plannedTurns: turnCount, optionalMarkerTurns: [...followUpTurns],
    automaticRetries: MAX_AUTO_RETRIES,
    retryCondition: "empty_answer (upstream stream interrupted); retried on a fresh conversation",
    channel: "published_website_api", publicationEvidence: manifest.dify.publication,
    baseline: manifest, baselineDirectory: SNAPSHOT,
    runnerSha256: sha256(fs.readFileSync("scripts/eval-current-scope.mjs")),
    limitations: ["Website proxy does not expose requirements or tool status; do not infer them from replies.",
      "Usage and cost are unknown through this endpoint.", "Proxy done does not independently prove the upstream message_end event.",
      "Semantic and factual grading requires review; marker checks alone do not establish task success."] });
  console.log(JSON.stringify({ runDir: dir, plannedTurns: turnCount }));
  const rows = [];
  // Consecutive empty answers that keep failing for the same non-network reason mean the
  // upstream is down (quota, plugin error); stop instead of burning the rest of the bank.
  const UNEXPECTED_STREAK = Number(process.env.EVAL_UNEXPECTED_STREAK ?? 3);
  let streak = 0; let stoppedEarly = null;
  for (const c of fixture.cases) {
    if (stoppedEarly) {
      for (const [index, turn] of c.turns.entries()) {
        const skipped = { key: `${c.id}-T${index + 1}`, caseId: c.id, query: turn.query,
          status: "not_run", reason: stoppedEarly };
        saveJson(path.join(dir, `${c.id}-T${index + 1}.json`), skipped); rows.push(skipped);
      }
      continue;
    }
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
      // Auto retry: an aborted upstream stream usually leaves no conversation behind,
      // so resending the same request on a fresh conversation is safe. Every attempt is
      // recorded on the row; only the final attempt is graded.
      const attempts = [{ errors: [...result.errors], firstDeltaMs: result.firstDeltaMs, latencyMs: result.latencyMs }];
      while (result.errors.includes("empty_answer") && attempts.length <= MAX_AUTO_RETRIES) {
        const dropped = result.errors.find((e) => e !== "empty_answer") ?? "empty_answer";
        console.log(JSON.stringify({ key, retry: attempts.length, after: dropped }));
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        const retryStartedAt = Date.now();
        try {
          const response = await fetch(`${BASE}/api/chat`, { method: "POST",
            headers: { "Content-Type": "application/json" }, body: JSON.stringify(request),
            signal: AbortSignal.timeout(120000) });
          result = await readChatStream(response, retryStartedAt);
        } catch (error) {
          result = { httpStatus: null, answer: "", conversationId: "", done: false,
            errors: [error.name === "TimeoutError" ? "request_timeout" : "request_failed"],
            firstDeltaMs: null, latencyMs: Date.now() - retryStartedAt };
        }
        attempts.push({ errors: [...result.errors], firstDeltaMs: result.firstDeltaMs, latencyMs: result.latencyMs });
      }
      const ids = productMarkers(result.answer);
      const cards = await cardsFor(ids);
      const row = { key, caseId: c.id,
        group: manifest.previouslySeenCaseIds?.includes(c.id) ? "regression" : c.group,
        originalGroup: c.group, completionEligible: c.completionEligible,
        startedAt: new Date(startedAt).toISOString(), request, expected: turn.expected,
        ...result, productIds: ids, cards, retryAttempts: attempts,
        failures: result.errors.filter((e) => !["application_stream_error", "no_proxy_done_event", "empty_answer"].includes(e)),
        checks: { technical: result.errors.length ? "failed" : "passed",
          ...checkCards(ids, cards, followUpTurns.has(key) ? { ...turn.expected, productSlugsOptional: true } : turn.expected, catalog),
          extraction: "unverified", toolConstraints: "unverified", semanticBehavior: "unverified", factualClaims: "unverified", visual: "unverified" },
        usage: result.usage ?? null, cost: null };
      saveJson(path.join(dir, `${key}.json`), row); rows.push(row);
      console.log(JSON.stringify({ key, technical: row.checks.technical, markers: row.checks.productMarkers, latencyMs: row.latencyMs }));
      const unexpected = [...new Set(result.errors.filter((e) => e !== "application_stream_error" && e !== "no_proxy_done_event" && e !== "empty_answer"))];
      if (!result.answer.trim() && unexpected.length) {
        streak += 1;
        if (streak >= UNEXPECTED_STREAK) stoppedEarly = `upstream_unavailable:${unexpected.join("+")}`;
      } else streak = 0;
      conversationId = result.conversationId;
      historyAvailable = Boolean(conversationId);
    }
  }
  saveJson(path.join(dir, "results.json"), { completedAt: new Date().toISOString(), stoppedEarly, results: rows });
  console.log(JSON.stringify({ completed: !stoppedEarly, stoppedEarly, runDir: dir, rows: rows.length, semanticReviewPending: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
