import type { Prisma } from "@/generated/prisma/client";
import { assistantRequirementsSchema, type AssistantRequirements } from "./assistant-requirements";

export const catalogProductSelect = {
  id: true, slug: true, name: true, description: true, priceCents: true,
  color: true, sizeLabel: true, material: true, careInstructions: true,
  refType: true, status: true, stock: true, tags: true, styleTags: true,
  occasionTags: true, returnPolicy: true,
  category: { select: { name: true, slug: true } },
  images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
} satisfies Prisma.ProductSelect;

export type CatalogProduct = Prisma.ProductGetPayload<{ select: typeof catalogProductSelect }>;
export type CatalogReader = {
  findMany(args: {
    where: Prisma.ProductWhereInput;
    select: typeof catalogProductSelect;
    orderBy: [{ priceCents: "asc" }, { id: "asc" }];
    take: number;
  }): Promise<CatalogProduct[]>;
};

export const categoryNames: Record<string, string> = {
  上衣: "tops", 上装: "tops", 裤子: "bottoms", 下装: "bottoms",
  连衣裙: "dresses", 外套: "outerwear", 鞋: "shoes", 鞋子: "shoes",
  鞋履: "shoes", 包: "accessories", 配饰: "accessories",
};

const genericCategoryTerms: Record<string, string[]> = {
  tops: ["上衣", "上装"], bottoms: ["下装"], dresses: [],
  outerwear: ["外套"], accessories: ["配饰"], shoes: ["鞋履"],
};

const styleAliases: Record<string, string> = {
  摇滚风: "摇滚", 极简风: "极简", 复古风: "复古", 休闲风: "休闲",
  简约风: "简约", 中性风: "中性", 基础款: "基础",
};

export function normalizeStyle(value: string): string { return styleAliases[value] ?? value; }

// "通勤/上班" describes when a garment is worn, not how it looks. The extractor
// may put such words into styleTags; matching them against the style column with
// hasEvery would drop every item that only has 极简/利落. Route them to occasions.
const occasionWords = new Set([
  "通勤", "上班", "通勤上班", "上班通勤", "日常", "休闲日常", "约会", "聚会",
  "婚礼", "度假", "运动", "居家", "出席活动", "正式场合",
]);

export function splitStyleAndOccasion(styleTags: string[]): { styles: string[]; occasions: string[] } {
  const styles: string[] = [];
  const occasions: string[] = [];
  for (const tag of styleTags) {
    const normalized = normalizeStyle(tag);
    const bare = normalized.replace(/(?:场景|场合|风)$/u, "");
    (occasionWords.has(normalized) || occasionWords.has(bare) ? occasions : styles).push(bare || normalized);
  }
  return { styles: [...new Set(styles)], occasions: [...new Set(occasions)] };
}

// Conservative lexical matching: preserve unknown words instead of broadening to
// every item in the category. Specific garment types use name/tags, not incidental
// mentions in a description such as "can be worn with trousers".
export function keywordFilters(requirements: AssistantRequirements): Prisma.ProductWhereInput[] {
  let remaining = requirements.q.toLowerCase();
  for (const style of requirements.styleTags) {
    const normalized = normalizeStyle(style);
    const forms = [...new Set([style, normalized, ...Object.keys(styleAliases).filter((key) => styleAliases[key] === normalized)])];
    for (const form of forms.sort((a, b) => b.length - a.length)) {
      remaining = remaining.split(form.toLowerCase()).join(" ");
    }
  }
  for (const generic of [...(genericCategoryTerms[requirements.category] ?? []), "衣服", "服装", "单品"]) {
    remaining = remaining.split(generic).join(" ");
  }
  const filters: Prisma.ProductWhereInput[] = [];
  const families = [
    { terms: ["裤子", "裤装", "裤"], match: ["裤"] },
    { terms: ["半身裙", "裙子", "裙"], match: ["裙"] },
    { terms: ["t恤", "t-shirt", "tee"], match: ["T恤", "T 恤", "T-shirt", "TEE"] },
    { terms: ["鞋子", "鞋"], match: ["鞋"] },
  ];
  for (const family of families) {
    if (!family.terms.some((term) => remaining.includes(term))) continue;
    for (const term of family.terms) remaining = remaining.split(term).join(" ");
    filters.push({ OR: family.match.flatMap((term) => [
      { name: { contains: term, mode: "insensitive" as const } },
      { tags: { has: term } },
    ]) });
  }
  for (const token of remaining.split(/[\s,，。/、]+/).filter(Boolean)) {
    filters.push({ OR: [
      { name: { contains: token, mode: "insensitive" } },
      { description: { contains: token, mode: "insensitive" } },
      { color: { contains: token, mode: "insensitive" } },
      { material: { contains: token, mode: "insensitive" } },
      { tags: { has: token } }, { occasionTags: { has: token } },
    ] });
  }
  return filters;
}

export async function queryCatalogProducts(
  input: AssistantRequirements,
  reader: CatalogReader,
  requestedLimit = 4,
) {
  const requirements = assistantRequirementsSchema.parse(input);
  const base = {
    scope: "catalog_single_item" as const,
    contractVersion: "catalog-search-v1",
    requirements,
    currentProduct: null,
    currentProductSource: null,
    products: [] as ReturnType<typeof toCatalogProduct>[],
    clarification: [] as string[],
    unresolvedRequirements: [] as string[],
    budgetAssessment: null as { minimumPriceCents: number; budgetCents: number; overByCents: number } | null,
    checkedConstraints: [] as string[],
  };
  if (requirements.intent !== "search" || (requirements.requestedCategories?.length ?? 0) > 1) {
    return { ...base, status: "unsupported_request",
      nextAction: "本次查询暂不能核对整套搭配、相似款或其他任务；不将单品候选当成完整解决方案，不放宽原要求。" };
  }
  const clarification = [...requirements.missingInformation];
  if (!requirements.category) clarification.unshift("想找哪一类商品");
  if (requirements.budgetScope === "unknown" || requirements.budgetScope === "total") {
    clarification.push("本次单件商品的预算上限是多少");
  }
  if (requirements.includeCurrentProduct === true) clarification.push("本次是另找单品，还是与指定商品一起购买");
  if (clarification.length) {
    return { ...base, status: "needs_clarification", clarification: [...new Set(clarification)],
      nextAction: "只澄清一项必要信息，保留其他要求，不指定顾客正在浏览的商品。" };
  }

  const excluded = new Set<string>();
  const unresolved: string[] = [];
  for (const requirement of requirements.otherRequirements) {
    const match = requirement.replace(/[\s，。！!]/g, "").match(/^(?:不要|不含|不包含|不需要)(上衣|上装|裤子|下装|连衣裙|外套|鞋子|鞋履|鞋|配饰)$/);
    if (match) excluded.add(categoryNames[match[1]]);
    else unresolved.push(requirement);
  }
  if (excluded.has(requirements.category)) {
    return { ...base, status: "needs_clarification", clarification: ["要查找的品类与排除条件冲突，请确认要找哪一类"],
      nextAction: "先确认相互冲突的品类要求，不自行取消排除条件。" };
  }
  if (unresolved.length) {
    return { ...base, status: "needs_verification", unresolvedRequirements: unresolved,
      nextAction: "说明尚不能核实的相关条件，不把未核实条件说成已满足，也不要求顾客重复已明确的要求。" };
  }

  const { styles, occasions } = splitStyleAndOccasion(requirements.styleTags);
  const where: Prisma.ProductWhereInput = {
    status: "ON_SALE", stock: { gt: 0 }, category: { slug: requirements.category },
    ...(styles.length ? { styleTags: { hasEvery: styles } } : {}),
    ...(occasions.length ? { occasionTags: { hasEvery: occasions } } : {}),
    AND: keywordFilters(requirements),
  };
  const limit = Math.max(1, Math.min(4, Math.trunc(requestedLimit) || 4));
  // Price ordering happens in the database BEFORE take. If the cheapest matching
  // item is over budget, no later item can be an affordable candidate.
  const candidates = await reader.findMany({
    where, select: catalogProductSelect, orderBy: [{ priceCents: "asc" }, { id: "asc" }], take: limit,
  });
  const checkedConstraints = ["在售且库存大于零", "品类", "正向关键词",
    ...(styles.length ? ["全部明确风格标签"] : []),
    ...(occasions.length ? [`适用场合：${occasions.join("、")}`] : []), "已识别的排除品类",
    ...(requirements.budgetCents === null ? [] : ["单件预算"])];
  const products = candidates.filter((p) => requirements.budgetCents === null || p.priceCents <= requirements.budgetCents)
    .map(toCatalogProduct);
  if (products.length) {
    return { ...base, checkedConstraints, status: "matched_known_constraints", products,
      nextAction: "从products中推荐单品，报价和商品ID取真实字段；仅声称已核对条件匹配，不把查询结果当作页面上下文。" };
  }
  if (candidates.length && requirements.budgetCents !== null) {
    const minimumPriceCents = candidates[0].priceCents;
    return { ...base, checkedConstraints, status: "over_budget",
      budgetAssessment: { minimumPriceCents, budgetCents: requirements.budgetCents, overByCents: minimumPriceCents - requirements.budgetCents },
      nextAction: "说明本次其他条件匹配商品的最低单价与超出金额，只询问是否愿意调整预算；不输出超预算商品卡片。" };
  }
  return { ...base, checkedConstraints, status: "no_match_for_query",
    nextAction: "说明按本次已记录条件暂未查到匹配，不扩大成全店无货；必要时只协商一个条件。" };
}

export function toCatalogProduct(product: CatalogProduct) {
  return {
    id: product.id, slug: product.slug, name: product.name, description: product.description,
    priceCents: product.priceCents, color: product.color, sizeLabel: product.sizeLabel,
    material: product.material, careInstructions: product.careInstructions,
    refType: product.refType, status: product.status, stock: product.stock,
    categoryName: product.category.name, categorySlug: product.category.slug,
    tags: product.tags, styleTags: product.styleTags, occasionTags: product.occasionTags,
    returnPolicy: product.returnPolicy, imageUrl: product.images[0]?.url ?? null,
  };
}
