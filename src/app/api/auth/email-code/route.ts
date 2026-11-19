import { NextResponse } from "next/server";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { isSmtpConfigured, sendVerificationCode } from "@/lib/mailer";
import { allowRateLimit } from "@/lib/rate-limit";

const CODE_TTL_MS = 5 * 60 * 1000; // 5 分钟
const SEND_INTERVAL_MS = 60 * 1000; // 同一邮箱 1 分钟内只能发一次

/**
 * POST /api/auth/email-code
 * body: { email }
 * → 生成 6 位验证码，存库，发邮件。
 * 登录或注册通用（验证码通过后，邮箱不存在会自动建号）。
 */
export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowRateLimit(`email-code:${ip}`, 10, 60_000)) {
    return NextResponse.json(
      { error: "发送太频繁，请稍后再试" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const email =
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email?: unknown }).email
      : undefined;
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "邮件服务暂未配置，请稍后再试" },
      { status: 503 },
    );
  }

  // 同一邮箱 1 分钟内只能发一次，避免刷邮件
  const recent = await prisma.emailCode.findFirst({
    where: {
      email: normalized,
      createdAt: { gte: new Date(Date.now() - SEND_INTERVAL_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    return NextResponse.json(
      { error: "验证码已发送，请稍后再试" },
      { status: 429 },
    );
  }

  const code = String(randomInt(0, 1000000)).padStart(6, "0");

  try {
    await sendVerificationCode(normalized, code);
  } catch (error) {
    console.error(
      "发送验证码邮件失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "验证码发送失败，请稍后再试" },
      { status: 500 },
    );
  }

  // 发送成功后落库（旧码不主动删，靠过期时间失效）
  await prisma.emailCode.create({
    data: {
      email: normalized,
      code,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  });

  // 不回传验证码，只回传「已发送」。演示/调试需要时再另说。
  return NextResponse.json({ ok: true });
}
