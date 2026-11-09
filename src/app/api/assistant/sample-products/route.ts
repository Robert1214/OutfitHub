import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sampleRequirementsSchema, querySampleProducts } from "@/lib/assistant-samples";
import { allowRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  // The fixture must never become a purchasable production catalog.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "不存在此接口" }, { status: 404 });
  }
  const expected = process.env.ASSISTANT_TOOL_TOKEN?.trim();
  if (!expected) return NextResponse.json({ error: "助手工具未配置" }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? "";
  const supplied = authorization.toLowerCase().startsWith("bearer ")
    ? authorization.slice(7).trim() : request.headers.get("x-assistant-token")?.trim() ?? "";
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (!a.length || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allowRateLimit(`assistant-samples:${ip}`, 60, 60_000)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }
  const params = new URL(request.url).searchParams;
  const raw = params.get("requirements");
  if (!raw || raw.length > 8000) {
    return NextResponse.json({ error: "请传入代码执行节点的 requirements" }, { status: 400 });
  }
  let decoded: unknown;
  try { decoded = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "requirements 不是有效 JSON" }, { status: 400 });
  }
  const parsed = sampleRequirementsSchema.safeParse(decoded);
  if (!parsed.success) {
    return NextResponse.json({ error: "需求字段缺失、类型或预算范围不正确" }, { status: 400 });
  }
  const anchor = params.get("anchorSampleId") ?? "";
  if (anchor && !["S01", "S02", "S03"].includes(anchor)) {
    return NextResponse.json({ error: "样例编号不存在；不能使用商品名称或数据库 ID" }, { status: 400 });
  }
  return NextResponse.json(querySampleProducts(parsed.data, anchor), {
    headers: { "Cache-Control": "no-store" },
  });
}
