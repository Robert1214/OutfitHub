export {};
// 受控实验：直接调 Dify chat-messages（blocking），传带标记的 product_context，
// 看回答能否复述资料内容。不打印密钥。
const base = (process.env.DIFY_API_BASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.DIFY_API_KEY?.trim();
if (!base || !key) throw new Error("缺少 DIFY_API_BASE_URL/DIFY_API_KEY");

async function main() {
  const res = await fetch(`${base}/chat-messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: {
        product_context: '{"name":"标记衬衫XYZ","priceCents":12300,"color":"标记蓝色","category":{"name":"上装"}}',
        size_advice: "",
        product_id: "",
      },
      query: "请直接告诉我：我提供的页面商品资料里，商品名称是什么、价格是多少元？如果资料为空或你看不到任何资料，就只回答「资料为空」。",
      response_mode: "blocking",
      user: "anon:debug-probe-20261113",
    }),
  });
  const body = await res.json();
  console.log("HTTP", res.status);
  console.log("answer:", body.answer);
}
main().catch((e) => { console.error(e); process.exit(1); });
