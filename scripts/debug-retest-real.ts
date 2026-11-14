async function runOnce(n: number) {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "想给这件衬衫配一条裤子，预算800元。",
      productSlug: "black-silk-shirt",
      anonId: `debug-retest-${n}`,
    }),
  });
  if (!res.ok) return `HTTP ${res.status}`;
  const text = await res.text();
  let answer = "";
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      if (j.type === "delta" && j.text) answer += j.text;
    } catch {}
  }
  return answer.replace(/\s+/g, " ").slice(0, 500);
}
async function main() {
  for (let i = 1; i <= 3; i++) {
    console.log(`\n===== 第${i}次 =====`);
    console.log(await runOnce(i));
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
