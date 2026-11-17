/**
 * 画布元素的类型与常量。
 * 坐标系：归一化 0~1，与分辨率解耦；x/y 为元素中心点。
 */

export type ItemCategory = "TOP" | "BOTTOM" | "SHOES" | "ACCESSORY";

/** 画布元素（存 DB 的 Outfit.canvas 就是这个数组） */
export type CanvasElement = {
  itemId: string;
  /** 白底图 COS key */
  imageKey: string;
  /** 中心点 x，0~1 */
  x: number;
  /** 中心点 y，0~1 */
  y: number;
  /** 相对初始宽度的缩放倍数 */
  scale: number;
  /** 旋转角度 -180~180 */
  rotation: number;
  /** 层级，越大越靠上 */
  zIndex: number;
};

export const CANVAS_SIZE = 2000;

/** 单品宽度占画布宽度的比例（初始） */
export const BASE_WIDTH_RATIO: Record<ItemCategory, number> = {
  TOP: 0.4,
  BOTTOM: 0.35,
  SHOES: 0.18,
  ACCESSORY: 0.18,
};

/** 分类排序优先级：上装 → 下装 → 鞋子 → 配饰 */
export const CATEGORY_ORDER: Record<ItemCategory, number> = {
  TOP: 0,
  BOTTOM: 1,
  SHOES: 2,
  ACCESSORY: 3,
};

/** 拖动吸附网格（画布像素） */
export const SNAP_PX = 8;

/** 画布最小/最大缩放（相对初始宽度） */
export const MIN_SCALE = 0.2;
export const MAX_SCALE = 3;

export const MIN_ITEMS = 2;
export const MAX_ITEMS = 8;

/** 校验并修正元素数值，防止越界值写进 DB */
export function clampElement(element: CanvasElement): CanvasElement {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  return {
    itemId: element.itemId,
    imageKey: element.imageKey,
    x: clamp(element.x, 0, 1),
    y: clamp(element.y, 0, 1),
    scale: clamp(element.scale, MIN_SCALE, MAX_SCALE),
    rotation: clamp(element.rotation, -180, 180),
    zIndex: Math.round(clamp(element.zIndex, 0, 999)),
  };
}

/** 判断一个 JSON 值是否是合法的画布数组 */
export function isCanvasArray(value: unknown): value is CanvasElement[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (item) =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as CanvasElement).itemId === "string" &&
      typeof (item as CanvasElement).imageKey === "string" &&
      typeof (item as CanvasElement).x === "number" &&
      typeof (item as CanvasElement).y === "number" &&
      typeof (item as CanvasElement).scale === "number" &&
      typeof (item as CanvasElement).rotation === "number" &&
      typeof (item as CanvasElement).zIndex === "number",
  );
}
