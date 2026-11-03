import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";

config({ path: ".env.local" });

const BASE = (process.env.EVAL_BASE_URL ?? "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const EVAL_FILE = path.join("memory-bank", "m5-eval.csv");
const OUT_FILE = path.join("memory-bank", "m5-eval-results.csv");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const LIMIT = limitArg ? Number(limitArg.split("=")[1]) : undefined;

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function extractMarkers(text) {
  const productIds = [];
  const citations = [];
  let clean = text;

  clean = clean.replace(/\[\[PRODUCTS:([^\]]+)\]\]/gi, (_match, ids) => {
    productIds.push(
      ...ids
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
    return "";
  });
  clean = clean.replace(/\[\[CITATIONS:([^\]]+)\]\]/gi, (_match, refs) => {
    citations.push(
      ...refs
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    );
    return "";
  });
  clean = clean.replace(
    /\[\[META\]\][\s\S]*?(?:\[\[\/META\]\]|$)/gi,
    "",
  );
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "");
  clean = clean.replace(/<!--[\s\S]*?-->/g, "");
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();

  return {
    clean,
    productIds: [...new Set(productIds)],
    citations: [...new Set(citations)],
  };
}

async function ask(query, anonId, conversationId = "", productSlug = "") {
  const startedAt = Date.now();
  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      anonId,
      conversationId: conversationId || undefined,
      productSlug: productSlug || undefined,
    }),
  });

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    return {
      answer: "",
      conversationId,
      error: data.error ?? `HTTP ${response.status}`,
      latencyMs: Date.now() - startedAt,
      firstTokenMs: null,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let nextConversationId = conversationId;
  let firstTokenMs = null;
  let error = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
      if (!line) continue;

      let event;
      try {
        event = JSON.parse(line);
      } catch {
        continue;
      }
      if (event.type === "delta" && event.text) {
        if (firstTokenMs === null) firstTokenMs = Date.now() - startedAt;
        answer += event.text;
      }
      if (event.type === "done" && event.conversationId) {
        nextConversationId = event.conversationId;
      }
      if (event.type === "error") {
        error = event.message ?? "stream_error";
      }
    }
  }

  return {
    answer,
    conversationId: nextConversationId,
    error,
    latencyMs: Date.now() - startedAt,
    firstTokenMs,
  };
}

async function lookupProducts(ids) {
  if (ids.length === 0) return [];
  const response = await fetch(
    `${BASE}/api/products?ids=${encodeURIComponent(ids.join(","))}`,
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data.products ?? [];
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const rows = parse(fs.readFileSync(EVAL_FILE, "utf8"), {
  columns: true,
  skip_empty_lines: true,
});
const selected = LIMIT ? rows.slice(0, LIMIT) : rows;
const results = [];

for (const [index, row] of selected.entries()) {
  const turns = row.conversation === "multi"
    ? row.input.split("→").map((part) => part.trim()).filter(Boolean)
    : [row.input];
  let conversationId = "";
  let answer = "";
  let error = "";
  let latencyMs = 0;
  let firstTokenMs = null;

  for (const query of turns) {
    const response = await ask(
      query,
      `eval-${row.id}`,
      conversationId,
      row.context_product,
    );
    answer += `\n${response.answer}`;
    conversationId = response.conversationId;
    error = response.error || error;
    latencyMs += response.latencyMs;
    if (firstTokenMs === null) firstTokenMs = response.firstTokenMs;
  }

  const extracted = extractMarkers(answer);
  const actualProducts = await lookupProducts(extracted.productIds);
  const actualSlugs = new Set(actualProducts.map((product) => product.slug));
  const expectedProducts = row.expected_products
    ? row.expected_products.split(";").map((item) => item.trim()).filter(Boolean)
    : [];
  const expectedHits = expectedProducts.filter((slug) => actualSlugs.has(slug));
  const invalidIds = extracted.productIds.filter(
    (id) => !actualProducts.some((product) => product.id === id),
  );

  results.push({
    id: row.id,
    input: row.input,
    expected_intent: row.expected_intent,
    expected_behavior: row.expected_behavior,
    expected_products: expectedProducts.join(";"),
    actual_products: [...actualSlugs].join(";"),
    expected_hits: expectedHits.join(";"),
    invalid_ids: invalidIds.join(";"),
    citations: extracted.citations.join(";"),
    answer: extracted.clean,
    latency_ms: latencyMs,
    first_token_ms: firstTokenMs ?? "",
    error,
  });

  console.log(
    `[${index + 1}/${selected.length}] ${row.id} ${error ? "ERROR" : "OK"} ${
      expectedProducts.length > 0
        ? `hit=${expectedHits.length}/${expectedProducts.length}`
        : ""
    } ${latencyMs}ms`,
  );
}

const header = [
  "id",
  "input",
  "expected_intent",
  "expected_behavior",
  "expected_products",
  "actual_products",
  "expected_hits",
  "invalid_ids",
  "citations",
  "answer",
  "latency_ms",
  "first_token_ms",
  "error",
];
const lines = [
  header.map(csvCell).join(","),
  ...results.map((result) =>
    header.map((key) => csvCell(result[key])).join(","),
  ),
];
fs.writeFileSync(OUT_FILE, `${lines.join("\n")}\n`);

const latencies = results.map((result) => result.latency_ms);
const totalIds = results.reduce(
  (sum, result) => sum + result.actual_products.split(";").filter(Boolean).length,
  0,
);
const invalidCount = results.reduce(
  (sum, result) => sum + result.invalid_ids.split(";").filter(Boolean).length,
  0,
);
const expectedCases = results.filter((result) => result.expected_products);
const expectedHitRate =
  expectedCases.reduce((sum, result) => {
    const expected = result.expected_products.split(";").filter(Boolean).length;
    const hits = result.expected_hits.split(";").filter(Boolean).length;
    return sum + (expected > 0 ? hits / expected : 0);
  }, 0) / Math.max(1, expectedCases.length);

console.log("\n=== Summary ===");
console.log(`results: ${OUT_FILE}`);
console.log(`cases: ${results.length}`);
console.log(`errors: ${results.filter((result) => result.error).length}`);
console.log(
  `invalid product id rate: ${
    totalIds > 0 ? `${((invalidCount / totalIds) * 100).toFixed(1)}%` : "0%"
  }`,
);
console.log(`expected product hit rate: ${(expectedHitRate * 100).toFixed(1)}%`);
console.log(`latency p50: ${percentile(latencies, 50)}ms`);
console.log(`latency p95: ${percentile(latencies, 95)}ms`);
