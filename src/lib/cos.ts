import { randomUUID } from "node:crypto";
import COS from "cos-nodejs-sdk-v5";

type CosConfig = {
  secretId: string;
  secretKey: string;
  bucket: string;
  region: string;
};

const USER_PHOTO_PREFIX = "user-photos";
const SIGNED_URL_EXPIRES_SECONDS = 1800;

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

/** 上传用户照片原图，返回 COS key。key 只存 DB，不返回前端。 */
export async function putUserPhoto(
  userId: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const config = getCosConfig();
  if (!config) throw new Error("COS_NOT_CONFIGURED");

  const key = `${USER_PHOTO_PREFIX}/${userId}/${randomUUID()}${extFor(contentType)}`;
  const cos = newCos(config);

  await new Promise<void>((resolve, reject) => {
    cos.putObject(
      {
        Bucket: config.bucket,
        Region: config.region,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      },
      (error) => (error ? reject(error) : resolve()),
    );
  });

  return key;
}

export async function getSignedPhotoUrl(key: string): Promise<string> {
  const config = getCosConfig();
  if (!config) throw new Error("COS_NOT_CONFIGURED");

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

export async function getSignedPhotoUrlSafe(
  key: string,
): Promise<string | null> {
  try {
    return await getSignedPhotoUrl(key);
  } catch (error) {
    console.error(
      "COS 生成签名 URL 失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

export async function deletePhotoObject(key: string): Promise<void> {
  const config = getCosConfig();
  if (!config) throw new Error("COS_NOT_CONFIGURED");

  const cos = newCos(config);
  await new Promise<void>((resolve, reject) => {
    cos.deleteObject(
      { Bucket: config.bucket, Region: config.region, Key: key },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}
