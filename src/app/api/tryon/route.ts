import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  countTodayTryons,
  listTryonRecords,
  loadTryonInputs,
  startTryon,
} from "@/lib/tryon/run";
import { DAILY_LIMIT, MAX_TRYON_ITEMS, MIN_TRYON_ITEMS } from "@/lib/tryon/types";
import { TryonError, USER_MESSAGES, httpStatus } from "@/lib/tryon/errors";
import { getSignedUrls } from "@/lib/cos";

/**
 * GET /api/tryon
 * → { records: [...], quota: { used, limit, remaining } }
 * 试穿历史页用。
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const [records, used] = await Promise.all([
    listTryonRecords(session.user.id),
    countTodayTryons(session.user.id),
  ]);

  const keys = records
    .map((record) => record.resultKey)
    .filter((key): key is string => Boolean(key));
  const signed = await getSignedUrls(keys);

  return NextResponse.json({
    records: records.map((record) => ({
      ...record,
      resultUrl: record.resultKey ? (signed[record.resultKey] ?? null) : null,
    })),
    quota: { used, limit: DAILY_LIMIT, remaining: Math.max(0, DAILY_LIMIT - used) },
  });
}

/**
 * POST /api/tryon
 * body: { itemIds: string[] }（1~4 件）
 * → { recordId }（约 1~2 秒返回，之后用 GET /api/tryon/[id] 轮询）
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const itemIds =
    typeof body === "object" && body !== null && "itemIds" in body
      ? (body as { itemIds?: unknown }).itemIds
      : undefined;
  if (
    !Array.isArray(itemIds) ||
    itemIds.some((id) => typeof id !== "string") ||
    itemIds.length < MIN_TRYON_ITEMS ||
    itemIds.length > MAX_TRYON_ITEMS
  ) {
    return NextResponse.json(
      { error: `请选择 ${MIN_TRYON_ITEMS}~${MAX_TRYON_ITEMS} 件单品` },
      { status: 400 },
    );
  }

  // 每日额度（5 次/天，每次 1 元）
  const used = await countTodayTryons(userId);
  if (used >= DAILY_LIMIT) {
    return NextResponse.json(
      { error: USER_MESSAGES["rate-limit"], quota: { used, limit: DAILY_LIMIT, remaining: 0 } },
      { status: httpStatus("rate-limit") },
    );
  }

  try {
    const inputs = await loadTryonInputs(userId, itemIds as string[]);
    const { recordId } = await startTryon(userId, inputs);

    return NextResponse.json(
      {
        recordId,
        quota: {
          used: used + 1,
          limit: DAILY_LIMIT,
          remaining: Math.max(0, DAILY_LIMIT - used - 1),
        },
      },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof TryonError) {
      // bad-input 的 message 本身就是友好文案（如「请先上传本人照片」），直接透传
      const message =
        error.kind === "bad-input" ? error.message : USER_MESSAGES[error.kind];
      return NextResponse.json(
        { error: message },
        { status: httpStatus(error.kind) },
      );
    }
    console.error(
      "发起试穿失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: USER_MESSAGES.internal },
      { status: 500 },
    );
  }
}
