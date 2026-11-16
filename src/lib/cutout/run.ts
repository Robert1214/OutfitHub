/**
 * 去背景流水线（服务端专用）：
 *   已有 COS 原图 → 签名 URL 给 MPS → 发起任务 → 轮询 → 下载结果 PNG → 存回 COS 私有桶。
 *
 * 不建任务表：MPS taskId 由前端暂存，轮询时连同 originalKey 一起回传；
 * originalKey 里带 userId 路径，服务端校验归属即可（越权返回 404）。
 */
import sharp from "sharp";
import { CutoutError, toCutoutError } from "./errors";
import {
  getCutoutConfig,
  pollCutoutTask,
  startCutoutTask,
  type CutoutConfig,
} from "./mps";
import {
  buildObjectKey,
  COS_PREFIX,
  deleteObject,
  getSignedUrl,
  putObject,
} from "@/lib/cos";

const PNG_CONTENT_TYPE = "image/png";

function requireConfig(): CutoutConfig {
  const cfg = getCutoutConfig();
  if (!cfg) throw new CutoutError("config", "缺少腾讯云配置");
  return cfg;
}

/** 校验 key 属于该用户（路径格式 `{prefix}/{userId}/...`） */
export function assertOwnedKey(userId: string, key: string): void {
  if (!key.startsWith(`${COS_PREFIX.wardrobe}/${userId}/`)) {
    throw new CutoutError("bad-input", "图片不属于当前用户");
  }
}

/** 发起去背景，返回 MPS TaskId */
export async function startCutout(originalKey: string): Promise<string> {
  const cfg = requireConfig();
  try {
    const imageUrl = await getSignedUrl(originalKey);
    return await startCutoutTask(cfg, { imageUrl });
  } catch (error) {
    throw toCutoutError(error, "发起去背景任务");
  }
}

export type CutoutPollResult =
  | { status: "RUNNING" }
  | { status: "SUCCEEDED"; whiteKey: string; url: string | null; color: string | null }
  | { status: "FAILED"; error: string };

/**
 * 查询一次去背景结果。
 * 成功时：结果 PNG 下载 → 校验 → 存 COS 私有桶 → 返回 whiteKey 与签名 URL。
 */
export async function pollCutout(
  userId: string,
  taskId: string,
): Promise<CutoutPollResult> {
  const cfg = requireConfig();

  let status;
  try {
    status = await pollCutoutTask(cfg, taskId);
  } catch (error) {
    throw toCutoutError(error, "查询去背景任务");
  }

  if (status.state === "running") return { status: "RUNNING" };
  if (status.state === "failed") {
    return { status: "FAILED", error: status.message };
  }

  // 下载结果图（链接 1 小时有效，必须及时落库）
  let buffer: Buffer;
  try {
    const res = await fetch(status.imageUrl);
    if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}`);
    buffer = Buffer.from(await res.arrayBuffer());
  } catch (error) {
    throw toCutoutError(error, "下载去背景结果");
  }

  // 校验确实是 PNG（MPS 若返回 JPG 说明透明底没生效，提示用户改传白底更好）
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buffer).metadata();
  } catch (error) {
    throw toCutoutError(error, "解析去背景结果");
  }
  if (meta.format !== "png") {
    throw new CutoutError(
      "task-failed",
      `去背景结果格式异常（${meta.format ?? "unknown"}）`,
    );
  }

  const whiteKey = buildObjectKey(COS_PREFIX.wardrobe, userId, PNG_CONTENT_TYPE);

  try {
    await putObject(whiteKey, buffer, PNG_CONTENT_TYPE);
  } catch (error) {
    throw toCutoutError(error, "保存去背景结果");
  }

  const [url, color] = await Promise.all([
    getSignedUrl(whiteKey).catch(() => null),
    extractDominantColor(buffer).catch(() => null),
  ]);

  return { status: "SUCCEEDED", whiteKey, url, color };
}

/**
 * 提取主色（供录入表单预填），返回 #RRGGBB。
 * 只统计不透明像素（alpha > 200），避免白底/透明区把颜色冲淡。
 */
export async function extractDominantColor(
  pngBuffer: Buffer,
): Promise<string | null> {
  const { data, info } = await sharp(pngBuffer)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const alpha = data[i + 3] ?? 255;
    if (alpha < 200) continue;
    r += data[i] ?? 0;
    g += data[i + 1] ?? 0;
    b += data[i + 2] ?? 0;
    count += 1;
  }
  if (count === 0) return null;

  const hex = (value: number) =>
    Math.round(value / count)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

/** 删除单品图（原图或白底图），尽力而为 */
export async function deleteWardrobeImage(key: string): Promise<void> {
  await deleteObject(key).catch((error: unknown) => {
    console.error(
      "删除 COS 图片失败：",
      error instanceof Error ? error.message : "unknown",
    );
  });
}
