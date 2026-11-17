/**
 * 试穿流水线（服务端专用），异步版：
 *   发起：读人像 + 单品白底图 → 签名 URL → 发起 MPS 任务 → 返回 taskId
 *   轮询：查一次 → 成功则下载图 → 存 COS 私有桶 → 返回结果 key
 *
 * 与旧项目不同：不再把图片塞进 JSON，直接用 COS 签名 URL 给 MPS
 * （人像 = User.photoKey，单品 = WardrobeItemImage.whiteKey 透明图）。
 */
import { prisma } from "@/lib/db";
import {
  buildObjectKey,
  COS_PREFIX,
  getObjectBuffer,
  getSignedUrl,
  putObject,
} from "@/lib/cos";
import { TryonError } from "./errors";
import { pollTryonTask, startTryonTask, buildTryonPromptWithBottoms } from "./mps";
import {
  CATEGORY_TO_REF_TYPE,
  MAX_TRYON_ITEMS,
  MIN_TRYON_ITEMS,
  TRYON_TIMEOUT_MS,
  getTryonConfig,
  type TryonConfig,
} from "./types";

const RESULT_CONTENT_TYPE = "image/png";

function requireConfig(): TryonConfig {
  const cfg = getTryonConfig();
  if (!cfg) throw new TryonError("config", "缺少腾讯云配置");
  return cfg;
}

export type TryonItemInput = {
  id: string;
  name: string;
  category: "TOP" | "BOTTOM" | "SHOES" | "ACCESSORY";
  whiteKey: string;
};

/** 读取用户人像 + 指定单品，校验归属 */
export async function loadTryonInputs(userId: string, itemIds: string[]) {
  const unique = Array.from(new Set(itemIds));
  if (unique.length < MIN_TRYON_ITEMS) {
    throw new TryonError("bad-input", "至少选 1 件单品");
  }
  if (unique.length > MAX_TRYON_ITEMS) {
    throw new TryonError("bad-input", `最多选 ${MAX_TRYON_ITEMS} 件单品`);
  }

  const [user, items] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { photoKey: true },
    }),
    prisma.wardrobeItem.findMany({
      where: { id: { in: unique }, userId },
      select: {
        id: true,
        name: true,
        category: true,
        images: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          select: { whiteKey: true },
        },
      },
    }),
  ]);

  if (!user?.photoKey) {
    throw new TryonError("bad-input", "请先在个人中心上传本人照片");
  }
  if (items.length !== unique.length) {
    throw new TryonError("bad-input", "部分单品不存在");
  }

  // 保持传入顺序（用户勾选顺序），便于 Prompt 编号稳定
  const ordered = unique.map((id) => items.find((item) => item.id === id)!);

  return {
    photoKey: user.photoKey,
    items: ordered.map(
      (item): TryonItemInput => ({
        id: item.id,
        name: item.name,
        category: item.category as TryonItemInput["category"],
        whiteKey: item.images[0]?.whiteKey ?? "",
      }),
    ),
  };
}

/**
 * 发起试穿：创建记录 + 发起 MPS 任务。
 * 返回 { recordId, mpsTaskId }，调用方立刻返回给前端。
 */
export async function startTryon(
  userId: string,
  inputs: { photoKey: string; items: TryonItemInput[] },
): Promise<{ recordId: string; mpsTaskId: string }> {
  const cfg = requireConfig();

  // 先建记录（PENDING），拿到 recordId 后才能把单品关联写进去
  const record = await prisma.tryonRecord.create({
    data: {
      userId,
      status: "PENDING",
      items: {
        create: inputs.items.map((item, index) => ({
          itemId: item.id,
          sortOrder: index,
        })),
      },
    },
    select: { id: true },
  });

  // 签名 URL 给 MPS（30 分钟有效，发起任务时就要能拉到）
  const [personUrl, ...refUrls] = await Promise.all([
    getSignedUrl(inputs.photoKey),
    ...inputs.items.map((item) => getSignedUrl(item.whiteKey)),
  ]);

  const refs = inputs.items.map((item, index) => ({
    type: CATEGORY_TO_REF_TYPE[item.category],
    url: refUrls[index],
    category: item.category,
  }));

  try {
    const mpsTaskId = await startTryonTask(cfg, {
      personUrl,
      refs: refs.map(({ type, url }) => ({ type, url })),
      prompt: buildTryonPromptWithBottoms(refs),
    });

    await prisma.tryonRecord.update({
      where: { id: record.id },
      data: { mpsTaskId, status: "RUNNING" },
    });

    console.log(
      `[tryon] 发起 ${record.id} 任务 ${mpsTaskId}，人像 ${inputs.photoKey}，` +
        inputs.items.map((i) => `${i.name}[${i.category}]`).join("、"),
    );

    return { recordId: record.id, mpsTaskId };
  } catch (error) {
    // 发起失败要落库，用户能看到失败原因，也能重试
    await prisma.tryonRecord.update({
      where: { id: record.id },
      data: {
        status: "FAILED",
        errorMessage: "生成失败，请重试",
      },
    });
    throw error;
  }
}

export type PollResult =
  | { status: "PENDING" | "RUNNING" }
  | { status: "SUCCEEDED"; resultKey: string }
  | { status: "FAILED"; error: string };

/**
 * 查询一次结果：
 * - 已经 SUCCEEDED/FAILED 直接返回
 * - 否则查一次 MPS；完成就下载图 → 存 COS → 更新记录
 * - 超过 3 分钟标超时
 */
export async function pollTryon(
  userId: string,
  recordId: string,
): Promise<PollResult> {
  const record = await prisma.tryonRecord.findFirst({
    where: { id: recordId, userId },
    select: {
      id: true,
      status: true,
      mpsTaskId: true,
      resultKey: true,
      errorMessage: true,
      createdAt: true,
    },
  });
  if (!record) throw new TryonError("bad-input", "记录不存在");

  if (record.status === "SUCCEEDED" && record.resultKey) {
    return { status: "SUCCEEDED", resultKey: record.resultKey };
  }
  if (record.status === "FAILED") {
    return { status: "FAILED", error: record.errorMessage ?? "生成失败" };
  }

  // 超时判定
  const elapsed = Date.now() - record.createdAt.getTime();
  if (elapsed > TRYON_TIMEOUT_MS) {
    await prisma.tryonRecord.update({
      where: { id: record.id },
      data: { status: "FAILED", errorMessage: "生成超时，请重试" },
    });
    return { status: "FAILED", error: "生成超时，请重试" };
  }

  if (!record.mpsTaskId) {
    return { status: "PENDING" };
  }

  const cfg = requireConfig();
  const taskStatus = await pollTryonTask(cfg, record.mpsTaskId);

  if (taskStatus.state === "running") {
    // 第一次查询时把 PENDING 推进到 RUNNING
    if (record.status === "PENDING") {
      await prisma.tryonRecord.update({
        where: { id: record.id },
        data: { status: "RUNNING" },
      });
    }
    return { status: "RUNNING" };
  }

  if (taskStatus.state === "failed") {
    console.error(`[tryon] ${record.id} 失败：`, taskStatus.message);
    await prisma.tryonRecord.update({
      where: { id: record.id },
      data: { status: "FAILED", errorMessage: "生成失败，请重试" },
    });
    return { status: "FAILED", error: "生成失败，请重试" };
  }

  // 成功：下载结果图 → 存 COS 私有桶（MPS 的 RMS 只保留 1 小时）
  let buffer: Buffer;
  try {
    const response = await fetch(taskStatus.imageUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    buffer = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error(
      "[tryon] 下载结果图失败：",
      error instanceof Error ? error.message : "unknown",
    );
    await prisma.tryonRecord.update({
      where: { id: record.id },
      data: { status: "FAILED", errorMessage: "结果保存失败，请重试" },
    });
    return { status: "FAILED", error: "结果保存失败，请重试" };
  }

  const key = buildObjectKey(COS_PREFIX.tryonResult, userId, RESULT_CONTENT_TYPE);
  try {
    await putObject(key, buffer, RESULT_CONTENT_TYPE);
  } catch (error) {
    console.error(
      "[tryon] 结果上传 COS 失败：",
      error instanceof Error ? error.message : "unknown",
    );
    await prisma.tryonRecord.update({
      where: { id: record.id },
      data: { status: "FAILED", errorMessage: "结果保存失败，请重试" },
    });
    return { status: "FAILED", error: "结果保存失败，请重试" };
  }

  await prisma.tryonRecord.update({
    where: { id: record.id },
    data: { status: "SUCCEEDED", resultKey: key, errorMessage: null },
  });

  return { status: "SUCCEEDED", resultKey: key };
}

/** 每日额度：从 DB 统计今天已发起的试穿次数（跨进程可靠） */
export async function countTodayTryons(userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return prisma.tryonRecord.count({
    where: { userId, createdAt: { gte: start } },
  });
}

/** 删除试穿记录，返回需要清理的 COS key */
export async function deleteTryonRecord(
  userId: string,
  recordId: string,
): Promise<string | null | undefined> {
  const record = await prisma.tryonRecord.findFirst({
    where: { id: recordId, userId },
    select: { id: true, resultKey: true },
  });
  if (!record) return undefined;

  await prisma.tryonRecord.delete({ where: { id: recordId } });
  return record.resultKey;
}

/** 试穿记录列表（历史页用） */
export async function listTryonRecords(userId: string, limit = 60) {
  const rows = await prisma.tryonRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      resultKey: true,
      errorMessage: true,
      createdAt: true,
      items: {
        orderBy: { sortOrder: "asc" },
        select: {
          item: {
            select: {
              id: true,
              name: true,
              category: true,
              images: {
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { flatKey: true, whiteKey: true },
              },
            },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    status: row.status as "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED",
    resultKey: row.resultKey,
    errorMessage: row.errorMessage,
    createdAt: row.createdAt,
    items: row.items.map((link) => ({
      id: link.item.id,
      name: link.item.name,
      category: link.item.category as TryonItemInput["category"],
      thumbKey:
        link.item.images[0]?.flatKey ?? link.item.images[0]?.whiteKey ?? null,
    })),
  }));
}

/** 供调试：人像 + 单品图是否都可读（不可读会报错，避免 MPS 拉到空图） */
export async function assertReadable(key: string): Promise<void> {
  const buffer = await getObjectBuffer(key);
  if (!buffer) throw new TryonError("bad-input", `图片不可读：${key}`);
}
