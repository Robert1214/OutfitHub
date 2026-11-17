import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getSignedUrlSafe } from "@/lib/cos";
import {
  deleteTryonRecord,
  pollTryon,
  countTodayTryons,
} from "@/lib/tryon/run";
import { DAILY_LIMIT } from "@/lib/tryon/types";
import { TryonError, USER_MESSAGES, httpStatus } from "@/lib/tryon/errors";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/tryon/[id]
 * 前端每 2 秒轮询一次。
 * → { status: PENDING|RUNNING }
 * → { status: SUCCEEDED, resultUrl }
 * → { status: FAILED, error }
 */
export async function GET(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await pollTryon(session.user.id, id);

    if (result.status === "SUCCEEDED") {
      return NextResponse.json({
        status: "SUCCEEDED",
        resultUrl: await getSignedUrlSafe(result.resultKey),
      });
    }
    if (result.status === "FAILED") {
      return NextResponse.json({ status: "FAILED", error: result.error });
    }
    return NextResponse.json({ status: result.status });
  } catch (error) {
    if (error instanceof TryonError) {
      return NextResponse.json(
        { error: USER_MESSAGES[error.kind] },
        { status: httpStatus(error.kind) },
      );
    }
    console.error(
      "查询试穿失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json({ error: "查询失败，请重试" }, { status: 500 });
  }
}

/**
 * DELETE /api/tryon/[id]
 * 删除记录并同步删 COS 结果图。
 */
export async function DELETE(_request: Request, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const { id } = await params;
  const resultKey = await deleteTryonRecord(session.user.id, id);
  if (resultKey === undefined) {
    return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  }

  if (resultKey) {
    const { deleteObject } = await import("@/lib/cos");
    await deleteObject(resultKey).catch(() => undefined);
  }

  const used = await countTodayTryons(session.user.id);
  return NextResponse.json({
    ok: true,
    quota: { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) },
  });
}
