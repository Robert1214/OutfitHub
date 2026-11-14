import { assistantRequirementsSchema, type AssistantRequirements } from "./assistant-requirements";
import {
  catalogProductSelect, categoryNames, keywordFilters, normalizeStyle,
  toCatalogProduct, type CatalogReader,
} from "./assistant-catalog";
import { ownerPairingRules } from "./assistant-pairing-rules";

type Outfit = {
  anchorProductId: string; candidateProductId: string; ruleId: string;
  pairingReason: string; anchorPriceCents: number; candidatePriceCents: number;
  outfitTotalCents: number; assessedPriceCents: number;
  budgetRemainderCents: number | null;
};

export async function queryAnchoredOutfits(
  input: AssistantRequirements, reader: CatalogReader, contextProductId = "", requestedLimit = 4,
) {
  const requirements = assistantRequirementsSchema.parse(input);
  const base = {
    scope: "catalog_anchored_outfit" as const, contractVersion: "catalog-outfit-v1",
    selectionScope: "owner_reviewed_pairs" as const, requirements,
    currentProduct: null as ReturnType<typeof toCatalogProduct> | null,
    currentProductSource: null as "catalog_page_context" | null,
    products: [] as ReturnType<typeof toCatalogProduct>[], outfits: [] as Outfit[],
    clarification: [] as string[], unresolvedRequirements: [] as string[], checkedConstraints: [] as string[],
    budgetAssessment: null as {
      anchorPriceCents: number; minimumCandidatePriceCents: number;
      minimumPriceCents: number; budgetCents: number; overByCents: number;
      includesAnchor: boolean;
    } | null,
    // 本次购买口径：只在某一方用于说明，不重复计价。
    purchaseBasis: "both" as "both" | "newItemsOnly",
    // 本次应向顾客报的金额（分）：按预算口径算好，回答节点不得自行改用整套合计。
    reportedPriceCents: null as number | null,
    limitations: ["仅核对店主已确认的具体组合，不能由此判断全店没有其他搭配。", "未核对顾客合身度。"],
  };
  if (requirements.intent !== "outfit" || (requirements.requestedCategories?.length ?? 0) > 1 ||
      (requirements.category && requirements.category !== "bottoms")) {
    return { ...base, status: "unsupported_request", nextAction: "本阶段只支持以已选定的页面上衣搭配一件下装，不把单品列表当完整组合。" };
  }
  const clarification = [...requirements.missingInformation];
  if (!requirements.category) clarification.unshift("想为这件上衣搭配哪类单品");
  // A page ID is context, not customer selection. Require the extractor to carry
  // an explicitly selected anchor, then verify it against the actual page ID.
  if (!contextProductId || !requirements.anchorProductId) {
    clarification.unshift("请先从选定上衣的商品详情页进入导购，并说明要以它搭配");
  } else if (requirements.anchorProductId !== contextProductId) {
    clarification.unshift("指定的搭配主体与当前页面不一致，请从选定上衣的详情页继续");
  }
  if (requirements.budgetCents !== null && (
    requirements.budgetScope === "unknown" || requirements.includeCurrentProduct === null ||
    (requirements.budgetScope === "item" && requirements.includeCurrentProduct === true)
  )) clarification.push("这笔预算是只买裤子，还是包含上衣与裤子的总预算");
  if (clarification.length) {
    return { ...base, status: "needs_clarification", clarification: [...new Set(clarification)],
      nextAction: "只问一个未明确条件，不重复确认已明确预算；不自动把页面商品当成顾客所选。" };
  }
  const [anchor] = await reader.findMany({
    where: { id: requirements.anchorProductId! }, select: catalogProductSelect,
    orderBy: [{ priceCents: "asc" }, { id: "asc" }], take: 1,
  });
  if (!anchor || anchor.status === "DRAFT" || anchor.status === "ARCHIVED") {
    return { ...base, status: "needs_clarification", clarification: ["未能核实选定上衣，请重新选择商品"],
      nextAction: "不编造主体名称、价格或商品卡片。" };
  }
  if (anchor.category.slug !== "tops") {
    return { ...base, status: "unsupported_request", nextAction: "当前只支持已选定上衣搭配下装。" };
  }
  base.currentProduct = toCatalogProduct(anchor);
  base.currentProductSource = "catalog_page_context";
  if (requirements.includeCurrentProduct !== false && (anchor.status !== "ON_SALE" || anchor.stock <= 0)) {
    return { ...base, status: "anchor_unavailable", nextAction: "这件上衣当前不可购买，不把它计入可购买组合；如顾客已拥有，先确认是否仅购买裤子。" };
  }

  const excluded = new Set<string>();
  const occasions = new Set<string>();
  const unresolved: string[] = [];
  for (const requirement of requirements.otherRequirements) {
    const normalized = requirement.replace(/[\s，。！!]/g, "");
    const exclusion = normalized.match(/^(?:不要|不含|不包含|不需要)(上衣|上装|裤子|下装|连衣裙|外套|鞋子|鞋履|鞋|配饰)$/);
    if (exclusion) excluded.add(categoryNames[exclusion[1]]);
    else if (["通勤", "上班", "通勤上班", "上班通勤", "适合通勤", "适合上班", "用于通勤"].includes(normalized)) occasions.add("通勤");
    else unresolved.push(requirement);
  }
  if (excluded.has("bottoms") || (excluded.has("tops") && requirements.includeCurrentProduct === true)) {
    return { ...base, status: "needs_clarification", clarification: ["购买品类与排除条件冲突，请确认这次购买哪些商品"],
      nextAction: "不自动删除顾客的排除条件。" };
  }
  if (unresolved.length) {
    return { ...base, status: "needs_verification", unresolvedRequirements: unresolved,
      nextAction: "说明尚未核实的条件，不把它当成顾客未提供，也不忽略后推荐。" };
  }
  const rules = ownerPairingRules.filter((rule) => rule.anchorSlug === anchor.slug);
  if (!rules.length) {
    return { ...base, status: "needs_verification", unresolvedRequirements: ["这件上衣尚无店主确认的具体搭配关系"],
      nextAction: "资料不足以确认搭配，不说全店无匹配，不由同色或共同标签推断适配。" };
  }
  const styles = [...new Set(requirements.styleTags.map(normalizeStyle))];
  // These confirmed pairs are deliberately small. Query every reviewed candidate
  // before budgeting/limiting; never let unrelated cheap items hide the known pair.
  const candidates = await reader.findMany({
    where: {
      id: { not: anchor.id }, slug: { in: rules.map((rule) => rule.candidateSlug) },
      status: "ON_SALE", stock: { gt: 0 }, category: { slug: "bottoms" },
      ...(styles.length ? { styleTags: { hasEvery: styles } } : {}),
      ...(occasions.size ? { occasionTags: { hasEvery: [...occasions] } } : {}),
      AND: keywordFilters(requirements),
    },
    select: catalogProductSelect, orderBy: [{ priceCents: "asc" }, { id: "asc" }], take: rules.length,
  });
  const includesAnchor = requirements.includeCurrentProduct === true;
  const purchaseBasis = includesAnchor ? "both" : "newItemsOnly";
  const evaluated = candidates.map((product) => {
    const rule = rules.find((rule) => rule.candidateSlug === product.slug)!;
    const outfitTotalCents = anchor.priceCents + product.priceCents;
    const assessedPriceCents = includesAnchor ? outfitTotalCents : product.priceCents;
    return { product, outfit: {
      anchorProductId: anchor.id, candidateProductId: product.id, ruleId: rule.id,
      pairingReason: rule.reason, anchorPriceCents: anchor.priceCents, candidatePriceCents: product.priceCents,
      outfitTotalCents, assessedPriceCents,
      budgetRemainderCents: requirements.budgetCents === null ? null : requirements.budgetCents - assessedPriceCents,
    } satisfies Outfit };
  });
  base.checkedConstraints = ["明确选定的页面主体", "候选在售且库存大于零", "候选品类及关键词", "全部明确风格标签",
    "店主确认的具体搭配关系", "已识别排除品类", ...(occasions.size ? ["通勤场合"] : []),
    ...(requirements.budgetCents === null ? [] : [includesAnchor ? "包含上衣与裤子的总预算" : "仅新购买下装的预算"])];
  const affordable = evaluated.filter(({ outfit }) => requirements.budgetCents === null || outfit.assessedPriceCents <= requirements.budgetCents)
    .slice(0, Math.max(1, Math.min(4, Math.trunc(requestedLimit) || 4)));
  if (affordable.length) {
    return { ...base, status: "matched_known_constraints", products: affordable.map(({ product }) => toCatalogProduct(product)),
      outfits: affordable.map(({ outfit }) => outfit), purchaseBasis,
      reportedPriceCents: affordable[0].outfit.assessedPriceCents,
      nextAction: purchaseBasis === "both"
        ? "以currentProduct说明主体，从products推荐下装；按outfits的outfitTotalCents说明两件合计，reportedPriceCents即本次应报金额；候选彼此是备选，卡片只用本轮products ID。"
        : "以currentProduct说明搭配主体（顾客已拥有或不计入本次预算），只按reportedPriceCents说明本次购买下装的金额，不得把上衣价格计入本次金额或合计；候选彼此是备选，卡片只用本轮products ID。" };
  }
  if (evaluated.length && requirements.budgetCents !== null) {
    const cheapest = evaluated[0].outfit;
    return { ...base, status: "over_budget", purchaseBasis,
      reportedPriceCents: cheapest.assessedPriceCents, budgetAssessment: {
      anchorPriceCents: anchor.priceCents, minimumCandidatePriceCents: cheapest.candidatePriceCents,
      minimumPriceCents: cheapest.assessedPriceCents, budgetCents: requirements.budgetCents,
      overByCents: cheapest.assessedPriceCents - requirements.budgetCents, includesAnchor,
    }, nextAction: "说明已核对组合的实际金额与差额，一次协商一个条件，确认前不提高预算，不输出商品标记。" };
  }
  // Owner decision D01-1 (2026-11-14): when nothing matches, still show the
  // closest reviewed items, flagging what each one violates, and offer exits.
  const partials = (requirements.budgetCents === null ? evaluated : evaluated.slice(0, 1)).slice(0, 2);
  return { ...base, status: "no_match_for_query", products: partials.map(({ product }) => toCatalogProduct(product)),
    outfits: partials.map(({ outfit }) => outfit), purchaseBasis,
    budgetAssessment: partials.length && requirements.budgetCents !== null
      ? { minimumPriceCents: partials[0].outfit.assessedPriceCents, budgetCents: requirements.budgetCents,
        overByCents: partials[0].outfit.assessedPriceCents - requirements.budgetCents, includesAnchor }
      : null,
    nextAction: partials.length
      ? "说明按当前全部条件没有完全匹配；按outfits展示最接近的已核对组合并明确标出它违反了哪一条（如超出预算多少），不得称为推荐或可接受；给出两个出口（调整条件 / 先到这里），最后询问是否需要转人工（演示）。卡片只用本轮products ID。"
      : "仅在店主已确认的具体组合范围内，当前条件没有匹配；不推断全店无组合，不拿其他品类或未确认关系补推荐。" };
}
