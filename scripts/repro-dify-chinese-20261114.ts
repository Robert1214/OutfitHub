export {};
// D1 后续：conversationId 404 与语义 400 的复现
// 用法：npx tsx --env-file=.env.local scripts/repro-dify-chinese-20261114.ts
const base = (process.env.DIFY_API_BASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.DIFY_API_KEY ?? "";
const realCtx = JSON.stringify({
  id: "cmvy255tt000caotqizp21rtq",
  name: "黑色真丝衬衫",
  slug: "black-silk-shirt",
  priceCents: 45900,
});

async function post(label: string, body: Record<string, unknown>) {
  const t0 = Date.now();
  const res = await fetch(`${base}/chat-messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ response_mode: "streaming", user: `repro-${Math.random()}`, ...body }),
  });
  const text = await res.text();
  const cid = text.match(/"conversation_id":"([^"]+)"/)?.[1];
  console.log(`${label.padEnd(30)} HTTP ${res.status} (${Date.now() - t0}ms) cid=${cid ?? "-"}`);
  return { status: res.status, cid };
}

async function main() {
  console.log("== A. 不存在的 conversationId ==");
  await post("fake cid", {
    inputs: { product_id: "", product_context: "" }, query: "hi", conversation_id: "00000000-0000-0000-0000-000000000000",
  });

  console.log("\n== B. 真实中文商品 context + simple query（多次）==");
  for (let i = 1; i <= 3; i++) {
    await post(`第${i}次`, {
      inputs: { product_id: "cmvy255tt000caotqizp21rtq", product_context: realCtx },
      query: "hi", conversation_id: "",
    });
  }

  console.log("\n== C. 真实中文商品 context + 中文 query（多次）==");
  for (let i = 1; i <= 2; i++) {
    await post(`第${i}次`, {
      inputs: { product_id: "cmvy255tt000caotqizp21rtq", product_context: realCtx },
      query: "想给这件衬衫配一条裤子，预算800元。", conversation_id: "",
    });
  }

  console.log("\n== D. 网络上与 C 相同，但 user 相同、连续两轮（真实续轮）==");
  const first = await post("第1轮", {
    inputs: { product_id: "cmvy255tt000caotqizp21rtq", product_context: realCtx },
    query: "想给这件衬衫配一条裤子，预算800元。", conversation_id: "", user: "same-user-1",
  });
  if (first.cid) {
    await post("第2轮（同一 user+cid）", {
      inputs: { product_id: "cmvy255tt000caotqizp21rtq", product_context: realCtx },
      query: "预算800元", conversation_id: first.cid, user: "same-user-1",
    });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
