/**
 * 腾讯云 MPS 去背景（服务端专用）。
 *
 * 实测（2026-11-17，见 memory-bank/cutout-verification-20261117.md）：
 *   ProcessImage + ImageTask.AiCutoutConfig { Type: "foreground", Model: "cutout-1.0-lite" }
 *   + ImageTask.EncodeConfig { Format: "PNG" }   ← 不指定 PNG 会输出 JPG，透明通道丢失
 *   耗时 1.8~2.4 秒，输出 PNG 透明底，四角 alpha≈0。
 *
 * 模型选择：**用 lite 不用 flash**。
 * 实测红底红字背景上的红衣服，flash 会把整件衣服抠掉（只留黑色图案，保留 4.3%），
 * lite 完整保留（72.5%）；其他 4 张图两者结果一致，但 lite 快一倍。
 *
 * 输出走 RMS（1 小时有效链接），需自行下载后转存 COS 私有桶。
 */
import { mps } from "tencentcloud-sdk-nodejs";

const MpsClient = mps.v20190612.Client;

/** 抠图模型：cutout-1.0-lite（实测对同色系背景更稳，且比 flash 快一倍） */
const CUTOUT_MODEL = "cutout-1.0-lite";
/** 结果目录（MPS 侧路径，仅影响签发链接地址） */
const OUTPUT_DIR = "/outfithub/cutout/";

export type CutoutConfig = {
  secretId: string;
  secretKey: string;
  mpsRegion: string;
};

export function getCutoutConfig(): CutoutConfig | null {
  const secretId = process.env.TENCENT_SECRET_ID?.trim();
  const secretKey = process.env.TENCENT_SECRET_KEY?.trim();
  if (!secretId || !secretKey) return null;
  return {
    secretId,
    secretKey,
    mpsRegion: process.env.TENCENT_MPS_REGION?.trim() || "ap-guangzhou",
  };
}

function newClient(cfg: CutoutConfig) {
  return new MpsClient({
    credential: { secretId: cfg.secretId, secretKey: cfg.secretKey },
    region: cfg.mpsRegion,
    profile: {
      httpProfile: { endpoint: "mps.tencentcloudapi.com", reqTimeout: 30 },
    },
  });
}

export type StartCutoutInput = {
  /** 公网可访问的图片地址（COS 签名 URL） */
  imageUrl: string;
};

/** 发起去背景任务，返回 MPS TaskId */
export async function startCutoutTask(
  cfg: CutoutConfig,
  input: StartCutoutInput,
): Promise<string> {
  const res = await newClient(cfg).ProcessImage({
    InputInfo: { Type: "URL", UrlInputInfo: { Url: input.imageUrl } },
    OutputStorage: { Type: "RMS" },
    OutputDir: OUTPUT_DIR,
    ImageTask: {
      AiCutoutConfig: {
        Switch: "ON",
        Type: "foreground",
        Model: CUTOUT_MODEL,
      },
      // 必须显式指定 PNG：默认会按原图格式输出，JPG 没有透明通道
      EncodeConfig: { Format: "PNG", Quality: 100 },
    },
  });

  const taskId = res.TaskId;
  if (!taskId) throw new Error("MPS 未返回任务 ID");
  return taskId;
}

export type CutoutTaskStatus =
  | { state: "running" }
  | { state: "succeeded"; imageUrl: string }
  | { state: "failed"; message: string };

/**
 * 查询一次任务状态（不等待，供轮询接口调用）。
 * 注意：MPS 的 FINISH 不等于成功，ErrMsg 非空表示实际失败——这个判断必须保留。
 */
export async function pollCutoutTask(
  cfg: CutoutConfig,
  taskId: string,
): Promise<CutoutTaskStatus> {
  const res = await newClient(cfg).DescribeImageTaskDetail({ TaskId: taskId });

  if (res.Status !== "FINISH") return { state: "running" };

  const errMsg = res.ErrMsg?.trim();
  if (errMsg) return { state: "failed", message: errMsg };

  const rawUrl = res.ImageProcessTaskResultSet?.[0]?.Output?.SignedUrl;
  if (!rawUrl) return { state: "failed", message: "任务完成但未返回图片" };

  // MPS 下发的是 http 链接，统一升级 https（旧项目踩过的坑：下载代理会拒 http）
  return { state: "succeeded", imageUrl: rawUrl.replace(/^http:\/\//i, "https://") };
}
