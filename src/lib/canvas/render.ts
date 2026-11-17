/**
 * 画布服务端渲染（sharp）：
 *   元素数组 + 白底图 → 2000×2000 白底 PNG。
 *
 * 关键点：前端 CSS transform 与服务端 sharp 的变换顺序必须一致，
 * 否则「预览一致」这条验收过不了。统一规则：
 *   1. 以元素中心为原点
 *   2. 先缩放（scale），再旋转（rotation）
 *   3. 平移到 (x, y) 归一化位置
 *   即 final = Translate(x,y) · Rotate(θ) · Scale(s) · CenterOrigin
 */
import sharp from "sharp";
import {
  BASE_WIDTH_RATIO,
  CANVAS_SIZE,
  type CanvasElement,
  type ItemCategory,
} from "./types";

export type RenderInput = {
  element: CanvasElement;
  category: ItemCategory;
  /** 白底图字节 */
  buffer: Buffer;
};

function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 计算元素在画布上的最终外框（用于生成 sharp 的 composite 输入） */
async function buildLayer(
  element: CanvasElement,
  category: ItemCategory,
  buffer: Buffer,
): Promise<{ input: Buffer; left: number; top: number; width: number; height: number }> {
  const targetWidth = Math.max(
    1,
    Math.round(CANVAS_SIZE * BASE_WIDTH_RATIO[category] * element.scale),
  );

  // 先按目标宽度等比缩放
  const resized = sharp(buffer).resize({ width: targetWidth, fit: "inside" });
  const resizedBuffer = await resized.png().toBuffer();

  const { width = targetWidth, height = targetWidth } =
    await sharp(resizedBuffer).metadata();

  // 旋转（撑大画布以免裁切，背景透明）
  const rotated =
    element.rotation === 0
      ? resizedBuffer
      : await sharp(resizedBuffer)
          .rotate(element.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .toBuffer();

  const meta = await sharp(rotated).metadata();
  const rw = meta.width ?? width;
  const rh = meta.height ?? height;

  // 以中心点定位
  const centerX = element.x * CANVAS_SIZE;
  const centerY = element.y * CANVAS_SIZE;

  return {
    input: rotated,
    left: Math.round(centerX - rw / 2),
    top: Math.round(centerY - rh / 2),
    width: rw,
    height: rh,
  };
}

/**
 * 渲染拼合图。按 zIndex 升序叠加（大的在上）。
 * 画布白底，多余部分自然被裁剪（sharp composite 会自动裁到画布内）。
 */
export async function renderCanvas(
  elements: RenderInput[],
): Promise<Buffer> {
  const ordered = [...elements].sort(
    (a, b) => a.element.zIndex - b.element.zIndex,
  );

  const layers = await Promise.all(
    ordered.map((item) =>
      buildLayer(item.element, item.category, item.buffer),
    ),
  );

  // composite 要求 left/top 可为负（超出画布的部分被裁掉）
  const composites = layers.map(({ input, left, top }) => ({
    input,
    left,
    top,
  }));

  return sharp({
    create: {
      width: CANVAS_SIZE,
      height: CANVAS_SIZE,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** 生成缩略图（列表页用，长边 600） */
export async function renderThumbnail(pngBuffer: Buffer): Promise<Buffer> {
  return sharp(pngBuffer)
    .resize({ width: 600, height: 600, fit: "inside" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export { degreesToRadians };
