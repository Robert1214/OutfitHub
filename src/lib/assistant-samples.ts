import { assistantRequirementsSchema, type AssistantRequirements } from "./assistant-requirements";
import fixture from "../../data/assistant-samples.json";

// Keep the fixture's existing import contract without coupling the catalog to its data.
export const sampleRequirementsSchema = assistantRequirementsSchema;
type Requirements = AssistantRequirements;

export function querySampleProducts(input: Requirements, anchorSampleId: string) {
  const requirements = sampleRequirementsSchema.parse(input);
  const anchorSample = fixture.products.find((p) => p.sampleId === anchorSampleId) ?? null;
  const requestedCategories = requirements.requestedCategories ?? [];
  // The configured fixture anchor is not browser context or evidence of a selection.
  // Keep the legacy field only for the already-scoped outfit calculation.
  const currentProduct = requirements.intent === "outfit" && requirements.category &&
    requestedCategories.length <= 1 ? anchorSample : null;
  // Only this observed synonym is normalized; arbitrary tags are not weakened.
  const requestedStyles = requirements.styleTags.map((tag) => tag === "摇滚风" ? "摇滚" : tag);
  const base = {
    scope: "internal_samples_only",
    fixtureVersion: fixture.version,
    sampleIds: fixture.products.map((p) => p.sampleId),
    currentProduct,
    currentProductSource: currentProduct ? "internal_sample_anchor" : null,
    requirements,
    selection: null,
    limitations: [
      "仅检查 S01–S03，不能推断全店或市场没有其他商品。",
      "样例没有数据库商品 ID，不输出 [[PRODUCTS:...]]，不声称可下单、现货、合身或退换。",
      "只验证候选品类、已记录风格、店主明确的两件适配规则和金额；其他条件仍需逐项核对。",
      "本工具不读取浏览页面；currentProduct仅为样例搭配计算的参考资料，不能证明顾客正在浏览或已选中该商品。",
    ],
  };
  if (["search", "outfit"].includes(requirements.intent) && requestedCategories.length > 1) {
    const clarification = [...requirements.missingInformation];
    if (requirements.budgetScope === "unknown") clarification.push("预算是单件还是合计");
    // A fixed fixture anchor is only a proposal until the customer selects it.
    const anchorCandidate = anchorSample && requestedCategories.some((category) => category === anchorSample.category)
      ? anchorSample : null;
    return {
      ...base,
      currentProduct: null,
      status: clarification.length ? "needs_clarification" : "needs_selection",
      products: [],
      evaluations: [],
      selection: { requestedCategories, anchorCandidate, anchorConfirmed: false },
      clarification,
      nextAction: clarification.length
        ? "只澄清列出的未知条件，保留已明确的品类、预算及排除要求。"
        : "多个待选品类已明确，先确定一件具体商品作为搭配主体。若候选主体符合顾客描述，可询问是否选用；否则仅询问先挑选哪个已知品类。不得将候选当成已选，不重复确认已明确的总预算，不宣称已找到整套搭配。",
    };
  }
  // Ask for the missing category before exposing unrelated fixture products.
  if (!requirements.category) {
    const clarification = [...new Set(["想找哪一类衣服", ...requirements.missingInformation])];
    if (requirements.budgetScope === "unknown") clarification.push("预算是单件还是合计");
    return {
      ...base,
      status: "needs_clarification",
      products: [],
      evaluations: [],
      clarification,
      nextAction: "先询问顾客想找哪一类衣服，保留已知预算；不指定具体商品，不声称知道顾客正在浏览哪件商品。",
    };
  }
  const candidates = fixture.products.filter((p) =>
    p.sampleId !== currentProduct?.sampleId && p.category === requirements.category,
  );
  const evaluations = candidates.map((product) => {
    const pair = currentProduct ? fixture.pairings.find((p) =>
      p.sampleIds.includes(currentProduct.sampleId) && p.sampleIds.includes(product.sampleId),
    ) : undefined;
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
