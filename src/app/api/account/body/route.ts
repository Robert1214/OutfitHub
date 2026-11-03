import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { bodyMetricsSchema } from "@/lib/validations/body";
import { formatZodIssues } from "@/lib/validations/auth";

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = bodyMetricsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodIssues(parsed.error) },
      { status: 400 },
    );
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        heightCm: parsed.data.heightCm,
        bustCm: parsed.data.bustCm,
        waistCm: parsed.data.waistCm,
        hipCm: parsed.data.hipCm,
      },
    });
  } catch (error) {
    console.error(
      "保存身材信息失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "保存失败，请稍后重试" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, body: parsed.data });
}
