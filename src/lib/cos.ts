import { randomUUID } from "node:crypto";
import COS from "cos-nodejs-sdk-v5";

type CosConfig = {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
};

/** COS 对象 key 前缀（按用途分目录，便于排查与生命周期规则） */
export const COS_PREFIX = {
  userPhoto: "user-photos",
  wardrobe: "wardrobe",
  outfit: "outfits",
  tryonResult: "tryon-results",
} as const;

export const SIGNED_URL_EXPIRES_SECONDS = 1800;

export function getCosConfig(): CosConfig | null {
  const secretId = process.env.TENCENT_SECRET_ID?.trim();
  const secretKey = process.env.TENCENT_SECRET_KEY?.trim();
  const bucket = process.env.TENCENT_COS_BUCKET?.trim();
  const region = process.env.TENCENT_COS_REGION?.trim() || "ap-guangzhou";
  if (!secretId || !secretKey || !bucket) return null;
  return { secretId, secretKey, bucket, region };
}

export function isCosConfigured(): boolean {
  return getCosConfig() !== null;
}

function requireConfig(): CosConfig {
  const config = getCosConfig();
  if (!config) throw new Error("COS_NOT_CONFIGURED");
  return config;
}

function newCos(config: CosConfig): COS {
  return new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey,
  });
}

function extFor(contentType: string): string {
  if (contentType === "image/png") return ".png";
  if (contentType === "image/webp") return ".webp";
  return ".jpg";
}

/** 生成随机对象 key：`{prefix}/{userId}/{uuid}{ext}` */
export function buildObjectKey(
  prefix: string,
  userId: string,
  contentType: string,
  suffix = "",
): string {
  return `${prefix}/${userId}/${randomUUID()}${suffix}${extFor(contentType)}`;
}

/** 通用上传：按给定 key 写入对象 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  const config = requireConfig();
  const cos = newCos(config);

  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      {
        Bucket: config.bucket,
        Region: config.region,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
      (error) => (error ? reject(error) : resolve()),
    );
  });

  return key;
}

/** 通用删除：对象不存在也视为成功（COS deleteObject 本身幂等） */
export async function deleteObject(key: string): Promise<void> {
  const config = requireConfig();
  const cos = newCos(config);

  await new Promise<void>((resolve, reject) => {
    cos.deleteObject(
      { Bucket: config.bucket, Region: config.region, Key: key },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

/** 通用签名 URL（私有桶临时访问，默认 30 分钟） */
export async function getSignedUrl(key: string): Promise<string> {
  const config = requireConfig();
  const cos = newCos(config);

  return new Promise<string>((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: config.bucket,
        Region: config.region,
        Key: key,
        Sign: true,
        Expires: SIGNED_URL_EXPIRES_SECONDS,
      },
      (error, data) => (error ? reject(error) : resolve(data.Url)),
    );
  });
}

/** 批量签名，失败的位置返回 null（列表页用，图片挂了不影响整页） */
export async function getSignedUrls(
  keys: string[],
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    keys.map(async (key) => {
      try {
        return [key, await getSignedUrl(key)] as const;
      } catch (error) {
        console.error(
          "COS 生成签名 URL 失败：",
          error instanceof Error ? error.message : "unknown",
        );
        return [key, null] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}

export async function getSignedUrlSafe(key: string): Promise<string | null> {
  try {
    return await getSignedUrl(key);
  } catch (error) {
    console.error(
      "COS 生成签名 URL 失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/* ---------- 以下为沿用旧接口名，内部走通用方法 ---------- */

/** 上传用户照片原图，返回 COS key。key 只存 DB，不返回前端。 */
export async function putUserPhoto(
  userId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const key = buildObjectKey(COS_PREFIX.userPhoto, userId, contentType);
  return putObject(key, buffer, contentType);
}

export const getSignedPhotoUrl = getSignedUrl;
export const getSignedPhotoUrlSafe = getSignedUrlSafe;
export const deletePhotoObject = deleteObject;
