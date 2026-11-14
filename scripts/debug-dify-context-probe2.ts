export {};
// 探针2：真实搭配问题 + 真实商品 context 直连 Dify。
// 若提取节点看到 context → 走 outfit 流程（818元超预算协商/或围绕衬衫回答）；
// 若走单品搜索推荐裤子 → 提取节点没看到 context。
const base = (process.env.DIFY_API_BASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.DIFY_API_KEY?.trim();
if (!base || !key) throw new Error("缺少 DIFY_API_BASE_URL/DIFY_API_KEY");

const context = JSON.stringify({
  id: "cmvy255tt000caotqizp21rtq",
  name: "黑色真丝衬衫",
  slug: "black-silk-shirt",
  description: "桑蚕丝面料，微收腰剪裁，垂坠感好。黑色经典，单穿或内搭都利落。",
  priceCents: 45900, color: "黑色", sizeLabel: "均码", refType: "GARMENT",
  material: "桑蚕丝 100%", careInstructions: "建议干洗",
  tags: ["真丝", "通勤", "极简"], styleTags: ["极简", "优雅", "利落"],
  occasionTags: ["通勤", "约会", "正式"], returnPolicy: "RETURNABLE",
  fitType: "SLIM", status: "ON_SALE",
  category: { name: "上装", slug: "tops" },
});

async function main() {
  const res = await fetch(`${base}/chat-messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: { product_context: context, size_advice: "", product_id: "" },
      query: "想给这件衬衫配一条裤子，预算800元。",
      response_mode: "blocking",
      user: "anon:debug-probe2-20261113",
    }),
  });
  const body = await res.json();
  console.log("HTTP", res.status);
  console.log("answer:", body.answer);
}
main().catch((e) => { console.error(e); process.exit(1); });
