/**
 * 腾讯云 MPS：AI 换装（服务端专用）。
 *
 * 从旧项目 src/lib/tryon/mps.ts 迁移，改成异步：
 *   - startTryonTask：只发起任务，返回 TaskId
 *   - pollTryonTask：查一次状态（不循环），由接口层调用
 *
 * 参数不得自行调整（PRD §3.9）：
 *   tryon-1.0-lite + 1K + identity 参考图
 */
import { mps } from "tencentcloud-sdk-nodejs";
import { TryonError } from "./errors";
import type { RefImageType, TryonConfig } from "./types";

const MpsClient = mps.v20190612.Client;

/** 换装模型：tryon-1.0-lite（实测效果够用，1.00 元/张） */
const TRYON_MODEL = "tryon-1.0-lite";
/** 输出分辨率：1K */
const OUTPUT_RESOLUTION = "1K";

/** 面部保持约束：所有换装指令统一追加，抑制面部被重绘 */
const FACE_PRESERVE_CLAUSE =
  "严格保持[图片1]中人物的五官、脸型、肤色、发型完全不变，不要重新生成面部；保持姿态、背景、光照不变。";

/** 把 [图片N] 按顺序拼成「[图片2]、[图片3]」 */
function refList(indices: number[]): string {
  return indices.map((n) => `[图片${n}]`).join("、");
}

/**
 * 按单品类型生成换装 Prompt。
 * 参考图在 ImageSet 里从 [图片2] 起、identity 固定最后，所以编号与上传顺序一致。
 */
export function buildTryonPrompt(types: RefImageType[]): string {
  const indices: Record<RefImageType, number[]> = {
    garment: [],
    accessories: [],
    shoes: [],
  };
  types.forEach((type, index) => indices[type].push(index + 2));

  const parts: string[] = [];
  if (indices.garment.length > 0) {
    parts.push(
      `将[图片1]中模特的服装替换为${refList(indices.garment)}中的服装单品，保持款式/颜色/版型一致；` +
        `每件都要完整替换所有部位（如肩部、袖子、袖口、领口、门襟、下摆等），` +
        `不要保留原服装的任何部分，不要把两件衣服拼接在一起`,
    );
  }
  if (indices.accessories.length > 0) {
    parts.push(
      `让模特佩戴${refList(indices.accessories)}中的配饰，只参考配饰的款式和颜色，不要复制参考图中的人物、脸、手、背景`,
    );
  }
  if (indices.shoes.length > 0) {
    parts.push(
      `将[图片1]中模特的鞋替换为${refList(indices.shoes)}中的鞋，保持款式/颜色一致`,
    );
  }

  const body = parts.length > 0 ? `${parts.join("；")}。` : "";
  return body + FACE_PRESERVE_CLAUSE;
}

/**
 * 生成 Prompt（带下装分支）。
 *
 * 旧项目只有 garment / accessories / shoes，单独一条裤子会被当成「服装」，
 * 模型可能只换上半身或换整套。这里在「只有下装」时补一个明确分支。
 */
export function buildTryonPromptWithBottoms(
  refs: { type: RefImageType; category?: "TOP" | "BOTTOM" | "SHOES" | "ACCESSORY" }[],
): string {
  const onlyBottom =
    refs.length === 1 && refs[0].category === "BOTTOM";

  if (onlyBottom) {
    return (
      "将[图片1]中模特**下半身的裤子/裙子**替换为[图片2]中的下装单品，" +
      "保持款式/颜色/版型一致；完整替换整个下半身（腰头、裤腿、裤脚），" +
      "不要改动上半身的服装。" +
      FACE_PRESERVE_CLAUSE
    );
  }

  return buildTryonPrompt(refs.map((ref) => ref.type));
}

export type RefImageUrl = { type: RefImageType; url: string };

export type StartTryonInput = {
  personUrl: string;
  refs: RefImageUrl[];
  prompt?: string;
};

function newClient(cfg: TryonConfig) {
  return new MpsClient({
    credential: { secretId: cfg.secretId, secretKey: cfg.secretKey },
    region: cfg.mpsRegion,
    profile: {
      httpProfile: { endpoint: "mps.tencentcloudapi.com", reqTimeout: 30 },
    },
  });
}

/** 发起 AI 换装任务，返回 TaskId（约 1~2 秒） */
export async function startTryonTask(
  cfg: TryonConfig,
  input: StartTryonInput,
): Promise<string> {
  try {
    const res = await newClient(cfg).ProcessImage({
      InputInfo: { Type: "URL", UrlInputInfo: { Url: input.personUrl } },
      // RMS：结果不落我们自己的存储，直接返回 1 小时有效的链接
      OutputStorage: { Type: "RMS" },
      OutputDir: "/outfithub/tryon/",
      ImageTask: {
        AiTryOnConfig: {
          Model: TRYON_MODEL,
          Resolution: OUTPUT_RESOLUTION,
          Prompt: input.prompt ?? buildTryonPrompt(input.refs.map((r) => r.type)),
        },
      },
      AddOnParameter: {
        // 参考图（官方上限 13 张）：服饰在前，identity 固定追加在最后，
        // 保证 Prompt 里 [图片2] 起的编号仍对应服饰参考图。
        ImageSet: [
          ...input.refs.map((ref) => ({
            Type: ref.type,
            Image: { Type: "URL", UrlInputInfo: { Url: ref.url } },
          })),
          {
            Type: "identity",
            Image: { Type: "URL", UrlInputInfo: { Url: input.personUrl } },
          },
        ],
      },
    });

    if (!res.TaskId) throw new Error("MPS 未返回任务 ID");
    return res.TaskId;
  } catch (error) {
    throw toMpsError(error, "发起换装任务");
  }
}

export type TryonTaskStatus =
  | { state: "running" }
  | { state: "succeeded"; imageUrl: string }
  | { state: "failed"; message: string };

/**
 * 查询一次任务状态（不循环，由接口层决定何时再查）。
 * 注意：MPS 的 FINISH 不等于成功，ErrMsg 非空表示实际失败——这个判断必须保留。
 */
export async function pollTryonTask(
  cfg: TryonConfig,
  taskId: string,
): Promise<TryonTaskStatus> {
  let res;
  try {
    res = await newClient(cfg).DescribeImageTaskDetail({ TaskId: taskId });
  } catch (error) {
    throw toMpsError(error, "查询换装任务");
  }

  if (res.Status !== "FINISH") return { state: "running" };

  const errMsg = res.ErrMsg?.trim();
  if (errMsg) return { state: "failed", message: errMsg };

  const rawUrl = res.ImageProcessTaskResultSet?.[0]?.Output?.SignedUrl;
  if (!rawUrl) return { state: "failed", message: "任务完成但未返回效果图" };

  // MPS 下发的是 http 链接，统一升级 https（旧项目踩过的坑：下载代理会拒 http）
  return { state: "succeeded", imageUrl: rawUrl.replace(/^http:\/\//i, "https://") };
}

function toMpsError(error: unknown, action: string): TryonError {
  const code = (error as { code?: string })?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MPS ${action} 失败 [${code}]:`, message);

  if (
    /AuthFailure|InvalidCredential|SignatureFailure|UnauthorizedOperation/i.test(code)
  ) {
    return new TryonError("config", `腾讯云密钥或 MPS 权限配置有误（${action}）`);
  }
  return new TryonError("task-failed", `MPS ${action} 失败：${message}`);
}
