import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isCosConfigured } from "@/lib/cos";
import {
  assertOwnedKey,
  pollCutout,
  startCutout,
  type CutoutPollResult,
} from "@/lib/cutout/run";
import { CUTOUT_USER_MESSAGES, toCutoutError } from "@/lib/cutout/errors";
import { allowRateLimit } from "@/lib/rate-limit";

/**
 * 进程内结果缓存：同一 taskId 的轮询结果只落库一次。
 * 目的：客户端刷新页面后重新轮询、或两个请求并发，不会在 COS 里写出多份白底图。
 * 单实例 Demo 足够；多实例部署可改为 DB 幂等表。
 */
const RESULT_CACHE_TTL_MS = 10 * 60 * 1000;
const resultCache = new Map<
  string,
  { at: number; result: Extract<CutoutPollResult, { status: "SUCCEEDED" }> }
>();

function readCache(userId: string, taskId: string) {
  const hit = resultCache.get(`${userId}:${taskId}`);
  if (!hit) return null;
  if (Date.now() - hit.at > RESULT_CACHE_TTL_MS) {
    resultCache.delete(`${userId}:${taskId}`);
    return null;
  }
  return hit.result;
}

function writeCache(
  userId: string,
  taskId: string,
  result: Extract<CutoutPollResult, { status: "SUCCEEDED" }>,
) {
  if (resultCache.size > 500) {
    const now = Date.now();
    for (const [key, value] of resultCache) {
      if (now - value.at > RESULT_CACHE_TTL_MS) resultCache.delete(key);
    }
  }
  resultCache.set(`${userId}:${taskId}`, { at: Date.now(), result });
}

/**
 * POST /api/wardrobe/cutout
 * body: { originalKey: string }
 * → { taskId }
 *
 * 原图必须已经在 COS 里（先调 /api/wardrobe/upload）。
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!isCosConfigured()) {
    return NextResponse.json(
      { error: "图片存储暂未配置，请稍后再试" },
      { status: 503 },
    );
  }

  const userId = session.user.id;
  if (!allowRateLimit(`cutout-start:${userId}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "处理太频繁了，请稍等一下" },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const originalKey =
    typeof body === "object" && body !== null && "originalKey" in body
      ? (body as { originalKey?: unknown }).originalKey
      : undefined;
  if (typeof originalKey !== "string" || !originalKey) {
    return NextResponse.json({ error: "缺少图片信息" }, { status: 400 });
  }

  try {
    assertOwnedKey(userId, originalKey);
  } catch {
    // 不属于当前用户 → 404，不暴露存在性
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }

  try {
    const taskId = await startCutout(originalKey);
    return NextResponse.json({ taskId });
  } catch (error) {
    const cutoutError = toCutoutError(error, "发起去背景任务");
    return NextResponse.json(
      { error: CUTOUT_USER_MESSAGES[cutoutError.code] },
      { status: cutoutError.code === "config" ? 503 : 502 },
    );
  }
}

/**
 * GET /api/wardrobe/cutout?taskId=xxx&originalKey=yyy
 * → { status: "RUNNING" }
 * → { status: "SUCCEEDED", whiteKey, url, color }
 * → { status: "FAILED", error }
 *
 * 前端每 2 秒轮询一次，直到 SUCCEEDED / FAILED。
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (!isCosConfigured()) {
    return NextResponse.json(
      { error: "图片存储暂未配置，请稍后再试" },
      { status: 503 },
    );
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("taskId");
  const originalKey = searchParams.get("originalKey");

  if (!taskId || !originalKey) {
    return NextResponse.json(
      { error: "缺少任务信息" },
      { status: 400 },
    );
  }

  try {
    assertOwnedKey(userId, originalKey);
  } catch {
    return NextResponse.json({ error: "图片不存在" }, { status: 404 });
  }

  const cached = readCache(userId, taskId);
  if (cached) {
    return NextResponse.json({
      status: cached.status,
      whiteKey: cached.whiteKey,
      flatKey: cached.flatKey,
      url: cached.url,
      flatUrl: cached.flatUrl,
      color: cached.color,
    });
  }

  try {
    const result = await pollCutout(userId, taskId);
    if (result.status === "SUCCEEDED") {
      writeCache(userId, taskId, result);
    }
    return NextResponse.json(result);
  } catch (error) {
    const cutoutError = toCutoutError(error, "查询去背景任务");
    return NextResponse.json(
      { error: CUTOUT_USER_MESSAGES[cutoutError.code] },
      { status: cutoutError.code === "config" ? 503 : 502 },
    );
  }
}
