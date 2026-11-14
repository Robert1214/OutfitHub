export {};
// 诊断脚本：查询 Dify 收到过的 inputs，确认 product_context 是否到达。
// 不打印任何密钥；只打印业务数据。
const base = (process.env.DIFY_API_BASE_URL ?? "").replace(/\/+$/, "");
const key = process.env.DIFY_API_KEY?.trim();
if (!base || !key) throw new Error("缺少 DIFY_API_BASE_URL/DIFY_API_KEY");

async function get(path: string) {
  const res = await fetch(`${base}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    console.log("HTTP", res.status, path, (await res.text()).slice(0, 200));
    return null;
  }
  return res.json();
}

async function main() {
  const targetUser = process.argv[2] ?? "anon:debug-anon-20261113";
  console.log("=== 用户:", targetUser, "===");
  const convs = await get(`/conversations?user=${encodeURIComponent(targetUser)}&limit=10&sort_by=-updated_at`);
  if (!convs || !Array.isArray(convs.data) || convs.data.length === 0) {
    console.log("该用户没有对话记录（可能 user 标识不对，试试脚本参数传别的 user，如 user:xxx）");
    return;
  }
  for (const c of convs.data.slice(0, 3)) {
    console.log(`\n--- 对话 ${c.id} 创建于 ${c.created_at} ---`);
    const msgs = await get(`/messages?conversation_id=${c.id}&user=${encodeURIComponent(targetUser)}&limit=10`);
    if (!msgs) continue;
    for (const m of (msgs.data ?? [])) {
      if (m.query === undefined) continue;
      console.log(`[query] ${m.query}`);
      if (m.inputs) {
        const pc = m.inputs.product_context ?? "";
        console.log(`[inputs.product_context 长度] ${pc.length}`);
        console.log(`[inputs.product_context] ${pc.slice(0, 300)}`);
        console.log(`[inputs 其他键] ${Object.keys(m.inputs).join(", ")}`);
      } else {
        console.log("[inputs] 无");
      }
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
