import { z } from "zod";
import fixture from "../../data/assistant-samples.json";

// This is a finite, internal fixture, not a replacement for catalog retrieval.
export const sampleRequirementsSchema = z.object({
  q: z.string().trim().max(80),
  intent: z.enum(["search", "outfit", "similar", "product_info", "color_advice", "unknown"]),
  category: z.enum(["tops", "bottoms", "dresses", "outerwear", "accessories", "shoes", ""]),
  styleTags: z.array(z.string().trim().min(1).max(50)).max(8),
  budgetCents: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable(),
  budgetScope: z.enum(["item", "total", "unknown", "none"]),
  includeCurrentProduct: z.boolean().nullable(),
  otherRequirements: z.array(z.string().trim().min(1).max(300)).max(20),
  missingInformation: z.array(z.string().trim().min(1).max(300)).max(20),
}).strict().refine(
  (value) => (value.budgetCents === null) === (value.budgetScope === "none"),
  "预算金额与预算范围不一致",
);

type Requirements = z.infer<typeof sampleRequirementsSchema>;

export function querySampleProducts(input: Requirements, anchorSampleId: string) {
  const requirements = sampleRequirementsSchema.parse(input);
  const currentProduct = fixture.products.find((p) => p.sampleId === anchorSampleId) ?? null;
  // Only this observed synonym is normalized; arbitrary tags are not weakened.
  const requestedStyles = requirements.styleTags.map((tag) => tag === "摇滚风" ? "摇滚" : tag);
  const base = {
    scope: "internal_samples_only",
    fixtureVersion: fixture.version,
    sampleIds: fixture.products.map((p) => p.sampleId),
    currentProduct,
    requirements,
    limitations: [
      "仅检查 S01–S03，不能推断全店或市场没有其他商品。",
      "样例没有数据库商品 ID，不输出 [[PRODUCTS:...]]，不声称可下单、现货、合身或退换。",
      "只验证候选品类、已记录风格、店主明确的两件适配规则和金额；其他条件仍需逐项核对。",
    ],
  };
  const candidates = fixture.products.filter((p) =>
    p.sampleId !== anchorSampleId &&
    (!requirements.category || p.category === requirements.category),
  );
  const evaluations = candidates.map((product) => {
    const pair = fixture.pairings.find((p) =>
      p.sampleIds.includes(anchorSampleId) && p.sampleIds.includes(product.sampleId),
    );
    const styleMatches = requestedStyles.every((tag) => product.styleTags.includes(tag));
    const pairCompatible = requirements.intent === "outfit" ? pair?.compatible ?? null : null;
    const candidateMatches = styleMatches &&
      (requirements.intent !== "outfit" || pairCompatible === true);
    let assessedPriceCents: number | null = null;
    if (requirements.budgetScope === "item") {
      assessedPriceCents = product.priceCents;
    } else if (requirements.budgetScope === "total" && requirements.intent === "outfit") {
      if (requirements.includeCurrentProduct === true && currentProduct) {
        assessedPriceCents = currentProduct.priceCents + product.priceCents;
      } else if (requirements.includeCurrentProduct === false) {
        assessedPriceCents = product.priceCents;
      }
    }
    const withinBudget = requirements.budgetCents === null ? null :
      assessedPriceCents === null ? null : assessedPriceCents <= requirements.budgetCents;
    return {
      product,
      styleMatches,
      pairCompatible,
      pairingReason: requirements.intent === "outfit" ? pair?.reason ?? "没有已确认的适配关系" : null,
      candidateMatches,
      assessedPriceCents,
      withinBudget,
      differenceCents: assessedPriceCents !== null && requirements.budgetCents !== null
        ? requirements.budgetCents - assessedPriceCents : null,
    };
  });
  const clarification = [...requirements.missingInformation];
  if (!["search", "outfit"].includes(requirements.intent)) clarification.push("本接口只核验找单品或两件搭配");
  if (!requirements.category) clarification.push("本次要查找哪一类搭配单品");
  if (requirements.intent === "outfit" && !currentProduct) clarification.push("搭配主体样例未指定或不存在");
  if (requirements.intent === "search" && requirements.budgetScope === "total") {
    clarification.push("独立搜索的总预算涉及哪些商品");
  }
  if (requirements.intent === "outfit" && requirements.budgetScope === "total" &&
      requirements.includeCurrentProduct === null) clarification.push("总预算是否包含搭配主体");
  if (requirements.budgetScope === "unknown") clarification.push("预算是单件还是合计");
  const matched = evaluations.filter((p) => p.candidateMatches);
  const affordable = matched.filter((p) => requirements.budgetCents === null || p.withinBudget === true);
  const products = clarification.length ? [] : affordable.map((p) => p.product);
  const status = clarification.length ? "needs_clarification" :
    matched.length === 0 ? "no_known_match_in_samples" :
    affordable.length === 0 ? "over_budget" : "matched_known_constraints";
  return {
    ...base,
    status,
    products,
    evaluations,
    clarification,
    nextAction: status === "over_budget" || status === "no_known_match_in_samples"
      ? "说明本组样例内的具体限制，一次只询问是否调整一个条件，确认前不放宽要求。"
      : status === "needs_clarification" ? "先澄清一个缺失条件，不宣称无商品。"
      : "按已知资料解释搭配和金额，仍须核对其他要求及资料限制。",
  };
}
