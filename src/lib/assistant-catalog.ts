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
  tops: ["上衣", "上装"], bottoms: ["下装", "裤装"], dresses: [],
  outerwear: ["外套"], accessories: ["配饰"], shoes: ["鞋履"],
};

const styleAliases: Record<string, string> = {
  摇滚风: "摇滚", 极简风: "极简", 复古风: "复古", 休闲风: "休闲",
  简约风: "简约", 中性风: "中性", 基础款: "基础",
};

const FAMILY_TERMS: Record<string, string[]> = {
  "裤": ["裤"], "裙": ["裙"], "T恤": ["T恤", "T 恤", "T-shirt", "TEE"], "鞋": ["鞋"],
};

// 款式家族（裤/裙/T恤/鞋）用内存判断，数据库只做粗筛：
// 数据库端 AND 一个家族条件时，若还叠加价格排序+take，会把目标款式提前截掉。
function familyWhere(match: string[]): Prisma.ProductWhereInput {
  return { OR: [
    ...match.map((term) => ({ name: { contains: term, mode: "insensitive" as const } })),
    ...match.map((term) => ({ tags: { has: term } })),
  ] };
}

function familyMatches(item: { name: string; tags: string[] }, terms: string[]): boolean {
  return terms.some((term) => item.name.includes(term) || item.tags.includes(term));
}

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
    // 款式家族改用共享的正则式「款式匹配」，和 keywordFilters 之外的调用方保持一致。
    filters.push(familyWhere(family.match));
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
    // 顾客要「衬衫配鞋」这类非下装搭配时，仍返回在售同类单品的候选项（candidates），
    // 由回答节点明确说明这只是单件推荐、不是搭配核对，避免用无库存依据的通用穿搭建议代替商品。
    if (requirements.category && requirements.category !== "bottoms") {
      const items = await reader.findMany({
        where: { status: "ON_SALE", stock: { gt: 0 }, category: { slug: requirements.category } },
        select: catalogProductSelect, orderBy: [{ priceCents: "asc" }, { id: "asc" }],
        take: Math.max(1, Math.min(4, Math.trunc(requestedLimit) || 4)),
      });
      return { ...base, status: "unsupported_request", candidates: items.map(toCatalogProduct),
        nextAction: "本工具不能核对这类搭配；candidates为非空同品类在售单品时，说明这只是单件推荐、不是整套搭配核对，可简短说明与顾客所提商品风格是否相配；不得给出没有库存依据的款式清单，不编造材质、保暖或防滑属性；candidates为空时说明本次没有可推荐的单品。" };
    }
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
  const occasions: string[] = [];
  // 场合词可带「适合/用于/穿去」等前缀，统一抽成场合值后交给 occasionTags 筛选。
  const asOccasion = (value: string) => {
    const trimmed = value.trim();
    if (occasionWords.has(trimmed)) return trimmed;
    const bare = trimmed.replace(/^(?:适合|用于|穿去|需要?)/u, "").trim();
    return occasionWords.has(bare) ? bare : null;
  };
  for (const requirement of requirements.otherRequirements) {
    const match = requirement.replace(/[\s，。！!]/g, "").match(/^(?:不要|不含|不包含|不需要)(上衣|上装|裤子|下装|连衣裙|外套|鞋子|鞋履|鞋|配饰)$/);
    if (match) excluded.add(categoryNames[match[1]]);
    // 「适合通勤/上班」是场景要求，商品有 occasionTags，应按场景筛选而不是当作无法核实的条件。
    else {
      const occasion = asOccasion(requirement);
      if (occasion) occasions.push(occasion);
      else unresolved.push(requirement);
    }
  }
  if (excluded.has(requirements.category)) {
    return { ...base, status: "needs_clarification", clarification: ["要查找的品类与排除条件冲突，请确认要找哪一类"],
      nextAction: "先确认相互冲突的品类要求，不自行取消排除条件。" };
  }
  if (unresolved.length) {
    // 顾客提了无法核实的偏好（显瘦、体型、防水等）：既不能当作已满足，也不能因此不给任何候选。
    // 走 D01-1：返回符合可核实条件的商品作为「最接近」，并列出未核实项，由回答节点如实标注。
    const { styles: nearStyles, occasions: nearStyleOccasions } = splitStyleAndOccasion(requirements.styleTags);
    const nearOccasions = [...new Set([...nearStyleOccasions, ...occasions])];
    // 品类按 q 里出现的具体款式（裤/裙/T恤/鞋）收窄；q 为空或没提到具体款式时才退回整个品类。
    // keywordFilters 的有界结果只有「款式家族」一种，通用词已在函数内剥离。
    const wantedFamilies = Object.keys(FAMILY_TERMS).filter((key) =>
      requirements.q.toLowerCase().includes(key.toLowerCase()));
    const hasFamily = wantedFamilies.length > 0;
    const broad: Prisma.ProductWhereInput = {
      status: "ON_SALE", stock: { gt: 0 }, category: { slug: requirements.category },
      ...(nearStyles.length ? { styleTags: { hasEvery: nearStyles } } : {}),
      ...(nearOccasions.length ? { occasionTags: { hasEvery: nearOccasions } } : {}),
      // 预算不能放进查询：先按价格升序取数会把预算内的高价候选挤掉。
      // 取回后再按「预算内优先、否则最接近」排序，超预算的也要保留下来如实标注。
    };
    const orderBy: [{ priceCents: "asc" }, { id: "asc" }] = [{ priceCents: "asc" }, { id: "asc" }];
    // 先取同品类最接近的若干件，再在内存里按款式家族（裤/裙/T恤/鞋）过滤；
    // 直接交给数据库 AND 会因取数上限先取到别的款式，导致过滤后为空。
    const pool = await reader.findMany({ where: broad, select: catalogProductSelect, orderBy, take: 24 });
    const sameFamily = hasFamily
      ? pool.filter((item) => wantedFamilies.some((key) => familyMatches(item, FAMILY_TERMS[key])))
      : pool;
    const budget = requirements.budgetCents;
    const inBudget = budget === null ? sameFamily : sameFamily.filter((item) => item.priceCents <= budget);
    // 预算内有符合可核实条件的就先给它们；没有才给最接近（可能超预算），并在回答里标出超出金额。
    // 预算内没有时，仍按与可核实条件最接近的顺序给候选（可能超预算），由回答标明差额。
    const trimmed = (inBudget.length ? inBudget : sameFamily).slice(0, 2);
    const minimumPriceCents = sameFamily.length ? sameFamily[0].priceCents : null;
    const overByCents = budget !== null && minimumPriceCents !== null && minimumPriceCents > budget
      ? minimumPriceCents - budget : null;
    return { ...base, status: "needs_verification", unresolvedRequirements: unresolved,
      products: trimmed.map(toCatalogProduct),
      budgetAssessment: (budget === null || overByCents === null) ? null
        : { minimumPriceCents: minimumPriceCents!, budgetCents: budget, overByCents },
      nextAction: trimmed.length
        ? "说明哪些条件无法核实（见unresolvedRequirements），不得把这些条件说成已满足。仍按 D01-1 展示products里最接近的单品并输出商品标记，逐件说明它满足哪些可核实条件、哪些无法核实；给出两个出口（调整条件 / 先到这里），涉及超预算或无法满足时最后询问是否需要转人工（演示）。"
        : "说明尚不能核实的相关条件，不把未核实条件说成已满足，也不要求顾客重复已明确的要求。" };
  }

  const { styles, occasions: styleOccasions } = splitStyleAndOccasion(requirements.styleTags);
  const allOccasions = [...new Set([...styleOccasions, ...occasions])];
  const relevance = { category: { slug: requirements.category } };
  const relevanceFilter = { category: { slug: requirements.category } } as const;
  const where: Prisma.ProductWhereInput = {
    status: "ON_SALE", stock: { gt: 0 }, ...relevanceFilter,
    ...(styles.length ? { styleTags: { hasEvery: styles } } : {}),
    ...(allOccasions.length ? { occasionTags: { hasEvery: allOccasions } } : {}),
    AND: keywordFilters(requirements),
  };
  // 顾客只说了宽泛品类（如“上衣”），没有给任何缩小条件时先问具体品类，避免一次列出一整类。
  // 只有「顾客除了宽泛品类之外什么都没说」才追问；预算、风格、场合、「别太贵」这类偏好都算已给方向。
  const narrowing =
    requirements.budgetCents !== null ||
    styles.length > 0 ||
    allOccasions.length > 0 ||
    keywordFilters(requirements).length > 0 ||
    unresolved.length > 0;
  if (!narrowing && requestedLimit > 1) {
    const available = await reader.findMany({ where, select: catalogProductSelect, orderBy: [{ priceCents: "asc" }, { id: "asc" }], take: 2 });
    if (available.length > 1) {
      return { ...base, status: "needs_clarification",
        clarification: ["具体想要哪一类款式或风格"],
        nextAction: "顾客只说了宽泛品类且没有其他条件时，先只问一句具体想要哪一类，本轮不推荐、不介绍商品、不输出商品标记。" };
    }
  }
  const limit = Math.max(1, Math.min(4, Math.trunc(requestedLimit) || 4));
  // Price ordering happens in the database BEFORE take. If the cheapest matching
  // item is over budget, no later item can be an affordable candidate.
  const orderBy: [{ priceCents: "asc" }, { id: "asc" }] = [{ priceCents: "asc" }, { id: "asc" }];
  // 取数上限留出余量：按价格升序取数时，预算内的合格商品可能排在被截断的位置之后。
  const candidates = await reader.findMany({ where, select: catalogProductSelect, orderBy, take: Math.max(limit, 8) });
  // D01-1: when nothing satisfies every condition, still fetch the in-stock items
  // of the same category so the nearest alternatives can be shown, flagged as such.
  const fallback = candidates.length ? []
    : await reader.findMany({ where: { status: "ON_SALE", stock: { gt: 0 }, ...relevance }, select: catalogProductSelect, orderBy, take: limit });
  const checkedConstraints = ["在售且库存大于零", "品类", "正向关键词",
    ...(styles.length ? ["全部明确风格标签"] : []),
    ...(occasions.length ? [`适用场合：${occasions.join("、")}`] : []), "已识别的排除品类",
    ...(requirements.budgetCents === null ? [] : ["单件预算"])];
  const products = candidates.filter((p) => requirements.budgetCents === null || p.priceCents <= requirements.budgetCents)
    .slice(0, limit).map(toCatalogProduct);
  if (products.length) {
    // Give the model the remainder as data so it rewrites "还剩 XX 元" verbatim
    // instead of re-deriving (and paraphrasing) the subtraction itself.
    const budgetRemainderCents = requirements.budgetCents === null ? null : requirements.budgetCents - products[0].priceCents;
    return { ...base, checkedConstraints, status: "matched_known_constraints", products, budgetRemainderCents,
      nextAction: budgetRemainderCents === null
        ? "从products中推荐单品，报价和商品ID取真实字段；仅声称已核对条件匹配，不把查询结果当作页面上下文。"
        : "从products中推荐单品，报价和商品ID取真实字段，并按budgetRemainderCents用「预算还剩XX元」的句式说明剩余额度，不得改写为「还差」「还欠」等其他含义；仅声称已核对条件匹配，不把查询结果当作页面上下文。" };
  }
  if (candidates.length && requirements.budgetCents !== null) {
    const minimumPriceCents = candidates[0].priceCents;
    return { ...base, checkedConstraints, status: "over_budget",
      // D01-1: return the over-budget item itself so the answer node can name it and
      // emit its marker; the rule still forbids presenting it as a recommendation.
      products: [toCatalogProduct(candidates[0])],
      budgetAssessment: { minimumPriceCents, budgetCents: requirements.budgetCents, overByCents: minimumPriceCents - requirements.budgetCents },
      nextAction: "说明本次其他条件匹配商品的最低单价与超出金额，不称为预算内推荐。按 D01-1：先说明没有完全匹配，再展示这件最接近的商品并明确标出超出金额（不得称为推荐或可接受），给出两个出口（调整条件 / 先到这里），最后询问是否需要转人工（演示）；输出该商品的商品标记。顾客尚未同意前不得提高预算。" };
  }
  return { ...base, checkedConstraints, status: "no_match_for_query", candidates: fallback.map(toCatalogProduct),
    nextAction: fallback.length
      ? "说明按本次已记录条件没有完全匹配；在candidates中展示最接近的单品（它们只匹配品类/在售，其他条件未满足），逐件标出违反了哪一条（如风格、关键词、超出预算多少），不得称为推荐或可接受；给出两个出口（调整条件 / 先到这里），最后询问是否需要转人工（演示）。"
      : "说明按本次已记录条件暂未查到匹配，不扩大成全店无货；必要时只协商一个条件。" };
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
