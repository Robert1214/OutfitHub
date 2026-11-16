/**
 * 去背景（抠图）的错误类型与用户文案。
 * 与试穿模块一致：内部保留原始错误，展示只用友好文案。
 */

export type CutoutErrorCode =
  | "config"
  | "bad-input"
  | "task-failed"
  | "timeout";

export class CutoutError extends Error {
  readonly code: CutoutErrorCode;

  constructor(code: CutoutErrorCode, message: string) {
    super(message);
    this.name = "CutoutError";
    this.code = code;
  }
}

/** 可直接展示给用户的文案 */
export const CUTOUT_USER_MESSAGES: Record<CutoutErrorCode, string> = {
  config: "去背景服务暂未配置，请稍后再试",
  "bad-input": "这张图无法处理，请换一张",
  "task-failed": "去背景失败，可以重试或直接上传白底图",
  timeout: "去背景超时，可以重试或直接上传白底图",
};

/** 内部错误 → 用户文案 */
export function toUserMessage(error: unknown): string {
  if (error instanceof CutoutError) return CUTOUT_USER_MESSAGES[error.code];
  return "去背景失败，可以重试或直接上传白底图";
}

/** 把 MPS / COS 的原始错误转成 CutoutError（日志留原文，用户看文案） */
export function toCutoutError(error: unknown, action: string): CutoutError {
  if (error instanceof CutoutError) return error;

  const code = (error as { code?: string })?.code ?? "";
  const message = error instanceof Error ? error.message : String(error);
  console.error(`去背景 ${action} 失败 [${code}]:`, message);

  if (
    /AuthFailure|InvalidCredential|SignatureFailure|UnauthorizedOperation/i.test(
      code,
    )
  ) {
    return new CutoutError("config", `腾讯云密钥或 MPS 权限配置有误（${action}）`);
  }
  return new CutoutError("task-failed", `MPS ${action} 失败：${message}`);
}
