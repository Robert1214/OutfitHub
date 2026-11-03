export type FitStyle = "SLIM" | "REGULAR" | "LOOSE";

export type BodyMetrics = {
  heightCm: number | null;
  bustCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
};

export type SizeProduct = {
  refType: "GARMENT" | "ACCESSORIES" | "SHOES";
  categorySlug: string;
  fitType: FitStyle | null;
  chestCm: number | null;
  lengthCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  pantsLengthCm: number | null;
};

export type SizeAdviceKind =
  | "fit"
  | "missing-body"
  | "missing-product"
  | "not-applicable";

export type SizeAdvice = {
  kind: SizeAdviceKind;
  summary: string;
  detail: string;
  tone: "ok" | "warn" | "muted";
  requiredFields: (keyof BodyMetrics)[];
};

const UPPER_EASE: Record<FitStyle, { min: number; max: number }> = {
  SLIM: { min: 4, max: 6 },
  REGULAR: { min: 6, max: 10 },
  LOOSE: { min: 10, max: 16 },
};

const LOWER_EASE: Record<
  FitStyle,
  { waist: { min: number; max: number }; hip: { min: number; max: number } }
> = {
  SLIM: {
    waist: { min: 1, max: 3 },
    hip: { min: 2, max: 4 },
  },
  REGULAR: {
    waist: { min: 3, max: 6 },
    hip: { min: 4, max: 8 },
  },
  LOOSE: {
    waist: { min: 6, max: 12 },
    hip: { min: 8, max: 14 },
  },
};

const FIT_LABEL: Record<FitStyle, string> = {
  SLIM: "紧身",
  REGULAR: "合身",
  LOOSE: "宽松",
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function hasBodyFields(
  body: BodyMetrics,
  fields: (keyof BodyMetrics)[],
): boolean {
  return fields.every((field) => {
    const value = body[field];
    return typeof value === "number" && value > 0;
  });
}

function missingBody(requiredFields: (keyof BodyMetrics)[]): SizeAdvice {
  const fieldLabels: Record<keyof BodyMetrics, string> = {
    heightCm: "身高",
    bustCm: "胸围",
    waistCm: "腰围",
    hipCm: "臀围",
  };
  return {
    kind: "missing-body",
    summary: "未填写信息",
    detail: `点击填写${requiredFields
      .map((field) => fieldLabels[field])
      .join("、")}，自动给出建议。`,
    tone: "muted",
    requiredFields,
  };
}

/**
 * 合身建议：纯函数，前后端共用。
 * 不输出 S/M/L，只给「合身 / 偏紧 / 偏松」和调整方向。
 */
export function getSizeAdvice(
  body: BodyMetrics,
  product: SizeProduct,
): SizeAdvice {
  if (product.refType !== "GARMENT") {
    return {
      kind: "not-applicable",
      summary: "该品类无需尺码建议",
      detail: "配饰与鞋履不参与服装合身判断。",
      tone: "muted",
      requiredFields: [],
    };
  }

  const isBottom = product.categorySlug === "bottoms";
  const fit = product.fitType ?? "REGULAR";

  if (isBottom) {
    if (product.waistCm === null || product.hipCm === null) {
      return {
        kind: "missing-product",
        summary: "暂无尺码数据",
        detail: "这件商品还缺少成衣腰围或臀围数据。",
        tone: "muted",
        requiredFields: ["waistCm", "hipCm"],
      };
    }
    if (!hasBodyFields(body, ["waistCm", "hipCm"])) {
      return missingBody(["waistCm", "hipCm"]);
    }

    const waistEase = round1(product.waistCm - body.waistCm!);
    const hipEase = round1(product.hipCm - body.hipCm!);
    const band = LOWER_EASE[fit];
    const tight =
      waistEase < band.waist.min || hipEase < band.hip.min;
    const loose =
      waistEase > band.waist.max || hipEase > band.hip.max;
    const summary = tight ? "偏紧" : loose ? "偏松" : "合身";
    const direction = tight
      ? "建议选大一码，或选更宽松的版型。"
      : loose
        ? "建议选小一码，或选更修身的版型。"
        : "建议按平时尺码购买。";

    return {
      kind: "fit",
      summary,
      detail: `腰围放量约 ${waistEase}cm、臀围约 ${hipEase}cm；${FIT_LABEL[fit]}版型建议腰围 ${band.waist.min}~${band.waist.max}cm、臀围 ${band.hip.min}~${band.hip.max}cm。${direction}`,
      tone: tight || loose ? "warn" : "ok",
      requiredFields: ["waistCm", "hipCm"],
    };
  }

  if (product.chestCm === null) {
    return {
      kind: "missing-product",
      summary: "暂无尺码数据",
      detail: "这件商品还缺少成衣胸围数据。",
      tone: "muted",
      requiredFields: ["heightCm", "bustCm"],
    };
  }
  if (!hasBodyFields(body, ["heightCm", "bustCm"])) {
    return missingBody(["heightCm", "bustCm"]);
  }

  const ease = round1(product.chestCm - body.bustCm!);
  const band = UPPER_EASE[fit];
  const tight = ease < band.min;
  const loose = ease > band.max;
  const summary = tight ? "偏紧" : loose ? "偏松" : "合身";
  const direction = tight
    ? "建议选大一码，或选更宽松的版型。"
    : loose
      ? "建议选小一码，或选更修身的版型。"
      : "建议按平时尺码购买。";

  return {
    kind: "fit",
    summary,
    detail: `胸围放量约 ${ease}cm；${FIT_LABEL[fit]}版型建议 ${band.min}~${band.max}cm。${direction}`,
    tone: tight || loose ? "warn" : "ok",
    requiredFields: ["heightCm", "bustCm"],
  };
}
