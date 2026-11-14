export {};
// 续轮（带 conversationId）复现：PM-012
// 用法：npx tsx --env-file=.env.local scripts/repro-multiturn-20261114.ts
const BASE = "http://localhost:3000/api/chat";

type Turn = { answer: string; events: string[]; ms: number; cid: string | null };

async function turn(query: string, conversationId: string | null): Promise<Turn> {
  const t0 = Date.now();
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      conversationId: conversationId ?? undefined,
      productSlug: "black-silk-shirt",
      anonId: `repro-${Date.now()}`,
    }),
  });
  let answer = "";
  let cid = conversationId;
  const events: string[] = [];
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j.type === "delta" && j.text) answer += j.text;
      else if (j.type !== "delta") {
        events.push(`${j.type ?? "error"}${j.error ? ":" + j.error : ""}`);
        if (j.type === "done" && j.conversationId) cid = j.conversationId;
      }
    } catch {
      events.push("unparsed:" + line.slice(0, 80));
    }
  }
  return { answer: answer.replace(/\s+/g, " ").trim(), events, ms: Date.now() - t0, cid };
}

async function main() {
  let cid: string | null = null;
  const questions = [
    "想给这件衬衫配一条裤子，预算800元。",
    "预算800元",
    "是总预算",
  ];
  for (const q of questions) {
    const r = await turn(q, cid);
    cid = r.cid;
    console.log(`\n>>> ${q}  (${(r.ms / 1000).toFixed(1)}s)  cid=${r.cid ?? "-"}`);
    if (r.events.length) console.log("events:", r.events.join(" | "));
    console.log("A:", r.answer || "（空）");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
