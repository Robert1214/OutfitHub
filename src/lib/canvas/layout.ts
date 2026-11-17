/**
 * 自动排版（纯函数，前后端共用）。
 *
 * 布局规则（PRD §3.5.2）：
 *   2 件   一行横排
 *   3~4 件 2×2 网格（3 件时第二行居中放 1 件）
 *   5~6 件 上 2 下 3
 *   7~8 件 上 3 下 4
 *
 * 难点：元素宽度不同（上装 0.4 / 下装 0.35 / 鞋 0.18），还要考虑图片宽高比，
 * 否则会重叠或超出画布。这里先算每行需要的总宽度，超出就整体等比缩小。
 */
import {
  BASE_WIDTH_RATIO,
  CANVAS_SIZE,
  CATEGORY_ORDER,
  type CanvasElement,
  type ItemCategory,
} from "./types";

export type LayoutInput = {
  itemId: string;
  imageKey: string;
  category: ItemCategory;
  /** 图片宽高比（宽/高）；缺省按 0.8 估算 */
  aspectRatio?: number;
};

/** 画布安全边距（归一化），避免元素贴边被裁 */
const SAFE_MARGIN = 0.06;

/**
 * 每行放几件 + 每行中心 y + 该行网格列数。
 * columns 用于让「不满的行」按网格左对齐（2×2 第 4 格空、上 2 下 3 等）。
 */
function rowPlan(count: number): {
  perRow: number[];
  rowYs: number[];
  columns: number[];
} {
  if (count <= 2) {
    return { perRow: [count], rowYs: [0.5], columns: [count] };
  }
  if (count <= 4) {
    const first = Math.min(2, count);
    return {
      perRow: [first, count - first].filter((n) => n > 0),
      rowYs: [0.32, 0.72],
      columns: [2, 2],
    };
  }
  if (count <= 6) {
    return { perRow: [2, count - 2], rowYs: [0.3, 0.7], columns: [2, 3] };
  }
  return { perRow: [3, count - 3], rowYs: [0.28, 0.72], columns: [3, 4] };
}

type Sized = LayoutInput & {
  /** 基准宽度（归一化，未缩放） */
  baseWidth: number;
  /** 基准高度（归一化，按宽高比推算） */
  baseHeight: number;
};

/**
 * 排一行：算出该行每个元素的实际缩放与 x 坐标。
 *
 * 关键：先按「满行」（columns 个元素）算出每一列的左边界，
 * 再只取前 row.length 个。这样 3 件时第二行的单品会落在 2×2 的第一列，
 * 视觉上「第 4 格空」，而不是被居中后与上行错位。
 */
function layoutRow(
  row: Sized[],
  gap: number,
  columns: number,
  /** 该列数分组内的统一列宽（保证上下行网格对齐） */
  columnBaseWidth: number,
): { x: number; widthScale: number }[] {
  const usable = 1 - SAFE_MARGIN * 2;

  const fullWidth = columnBaseWidth * columns + gap * (columns - 1);
  const fitScale = fullWidth > usable ? usable / fullWidth : 1;

  const colWidth = columnBaseWidth * fitScale;
  const stride = colWidth + gap;
  const totalWidth = colWidth * columns + gap * (columns - 1);
  const startX = (1 - totalWidth) / 2;

  return row.map((item, index) => {
    const width = item.baseWidth * fitScale;
    // 列位按网格对齐，元素在该列内水平居中
    const columnLeft = startX + index * stride;
    return {
      x: columnLeft + (colWidth - width) / 2 + width / 2,
      widthScale: fitScale,
    };
  });
}

/** 一行的最大高度（归一化），超出则再缩 */
function fitRowHeight(row: Sized[], widthScale: number, maxHeight: number): number {
  const tallest = Math.max(
    ...row.map((item) => item.baseHeight * widthScale),
  );
  if (tallest <= maxHeight || tallest === 0) return widthScale;
  return widthScale * (maxHeight / tallest);
}

/**
 * 生成初始画布元素。
 * 同分类元素保持输入顺序；整体按分类优先级重排（上装→下装→鞋→配饰）。
 */
export function autoLayout(items: LayoutInput[]): CanvasElement[] {
  const order = new Map(items.map((item, index) => [item.itemId, index]));
  const sized: Sized[] = [...items]
    .sort((a, b) => {
      const diff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
      return diff !== 0
        ? diff
        : (order.get(a.itemId) ?? 0) - (order.get(b.itemId) ?? 0);
    })
    .map((item) => {
      const baseWidth = BASE_WIDTH_RATIO[item.category];
      const ratio = item.aspectRatio && item.aspectRatio > 0 ? item.aspectRatio : 0.8;
      return { ...item, baseWidth, baseHeight: baseWidth / ratio };
    });

  const { perRow, rowYs, columns } = rowPlan(sized.length);
  const gap = sized.length <= 2 ? 0.08 : 0.04;
  const rowCount = perRow.length;
  const rowHeightBudget = rowCount === 1 ? 0.7 : 0.38;

  // 每组行按自己的列数取「该组最大元素宽度」作为统一列宽，
  // 这样同列数的上下行共享网格线（3 件时第二行与第一行同列，不错位）
  const columnBaseByGroup = new Map<number, number>();
  let scanCursor = 0;
  perRow.forEach((n, rowIndex) => {
    const cols = columns[rowIndex] ?? n;
    const row = sized.slice(scanCursor, scanCursor + n);
    scanCursor += n;
    const maxWidth = Math.max(...row.map((item) => item.baseWidth));
    const current = columnBaseByGroup.get(cols) ?? 0;
    columnBaseByGroup.set(cols, Math.max(current, maxWidth));
  });

  const result: CanvasElement[] = [];
  let cursor = 0;

  perRow.forEach((n, rowIndex) => {
    const row = sized.slice(cursor, cursor + n);
    cursor += n;
    if (row.length === 0) return;

    const cols = columns[rowIndex] ?? row.length;
    const placed = layoutRow(
      row,
      gap,
      cols,
      columnBaseByGroup.get(cols) ?? Math.max(...row.map((i) => i.baseWidth)),
    );
    const y = rowYs[rowIndex] ?? 0.5;
    const widthScale = placed[0]?.widthScale ?? 1;
    const finalScale = fitRowHeight(row, widthScale, rowHeightBudget);

    row.forEach((item, i) => {
      result.push({
        itemId: item.itemId,
        imageKey: item.imageKey,
        x: Number(placed[i].x.toFixed(4)),
        y,
        scale: Number(finalScale.toFixed(4)),
        rotation: 0,
        zIndex: result.length + 1,
      });
    });
  });

  return result;
}

/** 元素在画布上的实际像素宽度（初始比例 × 画布尺寸 × 缩放） */
export function elementWidthPx(
  category: ItemCategory,
  scale: number,
): number {
  return CANVAS_SIZE * BASE_WIDTH_RATIO[category] * scale;
}

/** 归一化坐标 → 画布像素 */
export function toCanvasPx(value: number): number {
  return Math.round(value * CANVAS_SIZE);
}

/** 吸附到网格（画布像素） */
export function snapToGrid(px: number, grid = 8): number {
  return Math.round(px / grid) * grid;
}
