// 2026-11-14 回归抽查：提取温度 0.2 + 预算包含关系规则加固后
// 用法：npx tsx scripts/regression-20261114.ts
const BASE = "http://localhost:3000/api/chat";

type Case = {
  id: string;
  query: string;
  productSlug?: string;
  conversationIdSeed?: string;
};

const cases: Case[] = [
  {
    id: "R1-预算搭配（页面衬衫）",
    query: "想给这件衬衫配一条裤子，预算800元。",
    productSlug: "black-silk-shirt",
  },
  {
    id: "R2-单品400极简裤子",
    query: "帮我找一条400元以内的极简风格裤子",
  },
  {
    id: "R3-比较题",
    query: "这两套怎么选？米白运动外套配休闲西裤，还是海军蓝衬衫配黑西裤？",
  },
  {
    id: "R4-搭配无页面主体",
    query: "我想给我已经有的上衣配条裤子，预算500元",
  },
];

async function runOne(c: Case) {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: c.query,
      ...(c.productSlug ? { productSlug: c.productSlug } : {}),
      anonId: `reg-20261114-${Math.random().toString(36).slice(2, 8)}`,
    }),
  });
  if (!res.ok) return `HTTP ${res.status}`;
  const raw = await res.text();
  let answer = "";
  const products: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j.type === "delta" && j.text) answer += j.text;
      if (j.type === "products" && Array.isArray(j.products))
        products.push(...j.products.map((p: { id: string }) => p.id));
    } catch {}
  }
  return { answer: answer.replace(/\s+/g, " ").trim(), products };
}

async function main() {
  for (const c of cases) {
    console.log(`\n===== ${c.id} =====`);
    console.log(`Q: ${c.query}`);
    const t0 = Date.now();
    const r = await runOne(c);
    console.log(`(耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    if (typeof r === "string") {
      console.log(r);
      continue;
    }
    console.log(`卡片ID: ${r.products.length ? r.products.join(", ") : "（无）"}`);
    console.log(`A: ${r.answer.slice(0, 600)}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
