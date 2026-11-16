import sharp from "sharp";

/** 图片校验规则（PRD §4.3）：JPG / PNG / WebP、单张 ≤8MB、≥200×200 */
export const IMAGE_LIMITS = {
  maxBytes: 8 * 1024 * 1024,
  minDimension: 200,
  maxFilesPerRequest: 9,
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type ValidatedImage = {
  buffer: Buffer;
  /** 统一的 MIME：image/jpeg / image/png / image/webp */
  contentType: string;
  /** sharp 解出的实际格式 */
  format: "jpeg" | "png" | "webp";
  width: number;
  height: number;
  bytes: number;
};

/** 校验失败时抛出，message 可直接展示给用户 */
export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

function normalizeContentType(format: string): string {
  if (format === "png") return "image/png";
  if (format === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * 校验单张图片。
 * 先看 MIME 与大小，再用 sharp 真正解码一次（防止改后缀的假图片），最后核尺寸。
 */
export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (!(IMAGE_LIMITS.allowedMimeTypes as readonly string[]).includes(file.type)) {
    throw new ImageValidationError("只支持 JPG / PNG / WebP 格式");
  }
  if (file.size > IMAGE_LIMITS.maxBytes) {
    throw new ImageValidationError(
      `「${file.name || "图片"}」超过 8MB，请压缩后再传`,
    );
  }
  if (file.size === 0) {
    throw new ImageValidationError(`「${file.name || "图片"}」是空文件`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  return validateImageBuffer(buffer, file.name);
}

/** 校验内存中的图片数据（去背景结果也复用这套） */
export async function validateImageBuffer(
  buffer: Buffer,
  label = "图片",
): Promise<ValidatedImage> {
  if (buffer.byteLength > IMAGE_LIMITS.maxBytes) {
    throw new ImageValidationError(`「${label}」超过 8MB，请压缩后再传`);
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(buffer).metadata();
  } catch {
    throw new ImageValidationError(`「${label}」无法识别，请换一张`);
  }

  const format = metadata.format;
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new ImageValidationError("只支持 JPG / PNG / WebP 格式");
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width < IMAGE_LIMITS.minDimension || height < IMAGE_LIMITS.minDimension) {
    throw new ImageValidationError(
      `「${label}」尺寸太小（${width}×${height}），至少需要 200×200`,
    );
  }

  return {
    buffer,
    contentType: normalizeContentType(format),
    format: format as ValidatedImage["format"],
    width,
    height,
    bytes: buffer.byteLength,
  };
}

/** 是否有透明像素（决定去背景结果要不要垫白底） */
export async function hasAlpha(buffer: Buffer): Promise<boolean> {
  const metadata = await sharp(buffer).metadata();
  return Boolean(metadata.hasAlpha);
}
