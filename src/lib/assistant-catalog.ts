import type { Prisma } from "@/generated/prisma/client";
import { assistantRequirementsSchema, hasNoStylePreference, isTagVerifiable, type AssistantRequirements } from "./assistant-requirements";

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

// 款式家族（裤/裙/T恤/鞋）是唯一一份定义：keywordFilters 用它拼查询条件，
// 「最接近商品」分支用它判断 q 想找的是不是这一族。新增款式只改这里。
export const garmentFamilies = [
  { key: "裤", intake: ["裤子", "裤装", "裤"], match: ["裤"] },
  { key: "裙", intake: ["半身裙", "裙子", "裙"], match: ["裙"] },
  { key: "T恤", intake: ["t恤", "t-shirt", "tee"], match: ["T恤", "T 恤", "T-shirt", "TEE"] },
  { key: "鞋", intake: ["鞋子", "鞋"], match: ["鞋"] },
] as const;

// 数据库端 AND 一个家族条件时，若还叠加价格排序+take，会把目标款式提前截掉；
// 所以「最接近商品」分支先在内存里按家族过滤，这里只负责拼条件。
function familyWhere(match: readonly string[]): Prisma.ProductWhereInput {
  return { OR: [
    ...match.map((term) => ({ name: { contains: term, mode: "insensitive" as const } })),
    ...match.map((term) => ({ tags: { has: term } })),
  ] };
}

function familyMatches(item: { name: string; tags: string[] }, terms: readonly string[]): boolean {
  return terms.some((term) => item.name.includes(term) || item.tags.includes(term));
}

// q 里点名的款式家族（如「显瘦的裤子」→ 裤）。没点名则返回空数组。
export function wantedFamilies(q: string): readonly (readonly string[])[] {
  const text = q.toLowerCase();
  return garmentFamilies.filter((family) => text.includes(family.key.toLowerCase())).map((family) => family.match);
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
  for (const family of garmentFamilies) {
    if (!family.intake.some((term) => remaining.includes(term))) continue;
    for (const term of family.intake) remaining = remaining.split(term).join(" ");
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

// 「最接近的商品」统一结构：满足什么、差在哪、属于哪类差异。
// 所有非 matched 状态都填这一个字段，回答节点只有一条收尾规则（见方案 v1 §2-2）。
export const budgetViolationText = (overByCents: number) =>
  `超出预算 ¥${(overByCents / 100).toFixed(2)}`;

// 「最接近的商品」统一结构：满足什么、差在哪、属于哪类差异。
// 所有非 matched 状态都填这一个字段，回答节点只有一条收尾规则（见方案 v1 §2-2）。
export type NearestProduct<T> = {
  product: T;
  satisfied: string[];
  violations: { field: string; text: string }[];
  role: "over_budget" | "unverified" | "no_match" | "extra_requirement";
  // 顾客说过「风格无所谓」时为 true：这些同类商品是可推荐的备选，不是「最接近」。
  alternativesRecommended?: boolean;
};

export function toNearest<T extends { priceCents: number; name: string }>(
  product: T, satisfied: string[], violations: { field: string; text: string }[],
  role: NearestProduct<T>["role"],
): NearestProduct<T> {
  return { product, satisfied, violations, role };
}

// 顾客问「显瘦/显高/遮肉/修饰腿型」时，从商品描述里找出能对上的版型依据，
// 交给回答节点当推荐理由（用户 2026-11-16：依据是内部判断用，话术要自然，
// 不许对顾客说「标签」「商品标了XX」）。只认 description 原文，不做推断。
const FEATURE_WORDS: Record<string, RegExp[]> = {
  显瘦: [/宽松/, /直筒/, /遮肉/, /显腿长/, /收腰/, /A\s*字/],
  显高: [/高腰/, /显腿长/],
  遮肉: [/宽松/, /遮肉/, /阔腿/],
  修饰腿型: [/直筒/, /阔腿/],
};
export function featureEvidence(description: string, wants: string[]): string[] {
  const hit = wants.filter((wanted) => (FEATURE_WORDS[wanted] ?? []).some((pattern) => pattern.test(description)));
  return hit.length ? [`版型依据：${description}`] : [];
}

// 最接近商品的 satisfied 列表：只列标语式可核实的条件，交付给回答节点原样引用。
function checkedNames(styles: string[], occasions: string[]): string[] {
  return ["在售且有库存", ...styles, ...occasions.map((occasion) => `场合：${occasion}`)];
}

// 商品缺少顾客明确要求的风格/场合标签时，逐条写成 violation；三处调用方共用。
// 用户 2026-11-16：这类偏好只要商品标签里标了就算满足（如「显瘦」）。
export const tagPreferences = new Set(["显瘦", "显高", "遮肉", "修饰腿型"]);

// 体型、身材相关的条件：推荐时作一句提醒即可，不像「防水」那样拦住推荐（用户 2026-11-16 决定 A）。
export const isBodyShape = (text: string): boolean =>
  /梨形|苹果形|身材|体型|体重|\d+\s*(?:斤|kg|公斤|千克)/iu.test(text);

export function missingTagViolations(
  item: { styleTags: string[]; occasionTags: string[] }, styles: string[], occasions: string[],
): { field: string; text: string }[] {
  const violations: { field: string; text: string }[] = [];
  // 「显瘦」等在常见中文里是风格词，抽取器会放进 styleTags，但商品本身没有风格标签，
  // 所以按「风格不符」处理，不称为暂时无法核实。
  const preferenceStyles = styles.filter((style) => tagPreferences.has(style));
  const missingStyles = styles.filter((style) => !preferenceStyles.includes(style) && !item.styleTags.includes(style));
  if (missingStyles.length) violations.push({ field: "style", text: `风格不符：缺少「${missingStyles.join("、")}」` });
  if (preferenceStyles.length) {
    const missingPreferences = preferenceStyles.filter((style) => !item.styleTags.includes(style));
    if (missingPreferences.length) violations.push({ field: "style", text: `没有标注「${missingPreferences.join("、")}」` });
  }
  const missingOccasions = occasions.filter((occasion) => !item.occasionTags.includes(occasion));
  if (missingOccasions.length) violations.push({ field: "occasion", text: `场合不符：不是「${missingOccasions.join("、")}」` });
  return violations;
}

// 非下装搭配（裙子配鞋、裤子配上衣）的候选：先按顾客条件（风格/场合/关键词/预算）筛，
// 一件都没有时退回同品类在售商品作为「最接近」，并逐条标出违反项。
// 用户 2026-11-16 决定：两个结合——按条件筛，筛不到仍要给出建议并带卡片。
export async function nearestForCategory(
  requirements: AssistantRequirements, reader: CatalogReader, requestedLimit: number,
): Promise<NearestProduct<ReturnType<typeof toCatalogProduct>>[]> {
  const limit = Math.max(1, Math.min(4, Math.trunc(requestedLimit) || 4));
  const { styles, occasions: styleOccasions } = splitStyleAndOccasion(requirements.styleTags);
  const allOccasions = [...new Set([...styleOccasions, ...requirements.otherRequirements.filter((item) =>
    occasionWords.has(item.trim()))])];
  // 顾客说「风格无所谓」：可核实条件下的其他在售同类就是备选替换，不再算「最接近」。
  const noStylePreference = hasNoStylePreference(requirements.q);
  const orderBy: [{ priceCents: "asc" }, { id: "asc" }] = [{ priceCents: "asc" }, { id: "asc" }];
  const filtered = await reader.findMany({
    where: {
      status: "ON_SALE", stock: { gt: 0 }, category: { slug: requirements.category },
      ...(styles.length ? { styleTags: { hasEvery: styles } } : {}),
      ...(allOccasions.length ? { occasionTags: { hasEvery: allOccasions } } : {}),
      AND: keywordFilters(requirements),
      ...(requirements.budgetCents === null ? {} : { priceCents: { lte: requirements.budgetCents } }),
    },
    select: catalogProductSelect, orderBy, take: limit,
  });
  if (filtered.length) {
    return filtered.map((item) => ({
      ...toNearest(toCatalogProduct(item), checkedNames(styles, allOccasions), [], "extra_requirement"),
      ...(noStylePreference ? { alternativesRecommended: true } : {}),
    }));
  }
  const broad = await reader.findMany({
    where: { status: "ON_SALE", stock: { gt: 0 }, category: { slug: requirements.category } },
    select: catalogProductSelect, orderBy, take: limit,
  });
  return broad.map((item) => ({
    ...toNearest(toCatalogProduct(item), ["在售且有库存"],
      [...missingTagViolations(item, styles, allOccasions),
        ...(requirements.budgetCents !== null && item.priceCents > requirements.budgetCents
          ? [{ field: "budget", text: budgetViolationText(item.priceCents - requirements.budgetCents) }] : [])],
      "extra_requirement"),
    outfit: null,
  }));
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
    // 体型等因人而异的条件：推荐照常给，只额外附一句提醒（用户 2026-11-16 决定 A）。
    fitNotes: [] as string[],
    currentProduct: null,
    currentProductSource: null,
    products: [] as ReturnType<typeof toCatalogProduct>[],
    clarification: [] as string[],
    unresolvedRequirements: [] as string[],
    budgetAssessment: null as { minimumPriceCents: number; budgetCents: number; overByCents: number } | null,
    checkedConstraints: [] as string[],
    // 「最接近的商品」：所有非 matched 状态统一放这里（结构见 NearestProduct）。
    nearest: [] as NearestProduct<ReturnType<typeof toCatalogProduct>>[],
    // 顾客问的款式已售罄时如实列出，回答节点先说明「有这款但售罄」。
    soldOut: [] as { name: string; category: string }[],
  };
  if (requirements.intent !== "search" || (requirements.requestedCategories?.length ?? 0) > 1) {
    // 顾客要「衬衫配鞋」这类非下装搭配时，仍返回在售同类单品的候选项（nearest），
    // 由回答节点明确说明这只是单件推荐、不是搭配核对，避免用无库存依据的通用穿搭建议代替商品。
    if (requirements.category && requirements.category !== "bottoms") {
      const nearest = await nearestForCategory(requirements, reader, requestedLimit);
      return { ...base, status: "unsupported_request", nearest,
        nextAction: nearest.length
          ? "说明本工具不能核对这类整套搭配；再按【收尾规则·唯一版本】处理nearest，并点明这只是单件推荐、不是整套搭配核对。"
          : "说明本工具不能核对这类搭配，且本次没有可推荐的在售单品；不得给出没有库存依据的款式清单，不编造材质、保暖或防滑属性。" };
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
    const noStylePreference = hasNoStylePreference(requirements.q);
    return { ...base, status: "needs_clarification", clarification: [...new Set(clarification)],
      ...(noStylePreference ? { noStylePreference: true } : {}),
      nextAction: noStylePreference
        ? "只澄清一项列出的事实（品类或预算）；风格已被顾客明确说成无所谓，不得追问风格，也不得描述任何商品（本轮没有商品数据）。"
        : "只澄清一项必要信息，保留其他要求，不指定顾客正在浏览的商品。" };
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
    const families = wantedFamilies(requirements.q);
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
    // 顾客点名的款式如果已售罄，也要如实带出来（否则「问乐福鞋」只说最接近的板鞋）。
    const soldOut = await findSoldOutByTokens(reader, requirements);
    base.soldOut = soldOut.map(({ name, category }) => ({ name, category: category.name }));
    const sameFamily = families.length
      ? pool.filter((item) => families.some((terms) => familyMatches(item, terms)))
      : pool;
    const budget = requirements.budgetCents;
    const inBudget = budget === null ? sameFamily : sameFamily.filter((item) => item.priceCents <= budget);
    // 预算内有符合可核实条件的就先给它们；没有才给最接近（可能超预算），并在回答里标出超出金额。
    const trimmed = (inBudget.length ? inBudget : sameFamily).slice(0, 2);
    const minimumPriceCents = sameFamily.length ? sameFamily[0].priceCents : null;
    const overByCents = budget !== null && minimumPriceCents !== null && minimumPriceCents > budget
      ? minimumPriceCents - budget : null;
    // 显瘦等偏好只要商品标签里写着，就算已核实（用户 2026-11-16 决定），不再列为「暂时无法核实」。
    // 但只要有一件候选查不动体型等真正没依据的条件，全体候选都保留该未核实项，避免误报「全都满足」。
    const tagOk = (item: { tags: string[]; styleTags: string[] }, text: string) =>
      isTagVerifiable(text, [...item.tags, ...item.styleTags]);
    const stillUnresolved = unresolved.filter((text) => !trimmed.every((item) => tagOk(item, text)));
    const nearest = trimmed.map((item) => {
      const violations: { field: string; text: string }[] = [
        ...stillUnresolved.map((text) => ({ field: "unverified", text })),
        ...(budget !== null && item.priceCents > budget
          ? [{ field: "budget", text: budgetViolationText(item.priceCents - budget) }] : []),
      ];
      // 每件商品的「符合XX」只算它自己已经能核实的条件。
      const verified = unresolved.filter((text) => tagOk(item, text));
      return toNearest(toCatalogProduct(item),
        [...checkedNames(nearStyles, nearOccasions), ...verified.map((text) => `符合${text}`), ...featureEvidence(item.description, verified)],
        violations, "unverified");
    });
    // 用户 2026-11-16 决定 A：可核实的核心条件（显瘦等）满足、预算也够时，直接推荐并出卡；
    // 体型合身（梨形身材、160斤）这类没依据的只作一句提醒，不再拦住推荐、也不再说「没有完全匹配」。
    const withinBudget = inBudget.slice(0, 4);
    // 只有体型/身材类「因人而异」的提醒不拦推荐；防水、腰围这类硬条件没核实仍是问题。
    const softUnresolved = stillUnresolved.filter(isBodyShape);
    const hardUnresolved = stillUnresolved.filter((text) => !isBodyShape(text));
    const recommending = hardUnresolved.length === 0 &&
      (stillUnresolved.length === 0 || (withinBudget.length > 0 && withinBudget.length === trimmed.length));
    const reminders = recommending ? softUnresolved.map((text) => `${text}（穿着合身因人而异，可再问人工确认）`) : [];
    if (recommending && withinBudget.length) {
      const products = withinBudget.map(toCatalogProduct);
      const verifiedForAll = unresolved.filter((text) =>
        withinBudget.some((item) => tagOk(item as { tags: string[]; styleTags: string[] }, text)));
      return { ...base, status: "matched_known_constraints", products, nearest: [],
        checkedConstraints: [...checkedNames(nearStyles, nearOccasions), ...verifiedForAll.map((text) => `符合${text}`)],
        fitNotes: reminders,
        budgetRemainderCents: budget === null ? null : budget - withinBudget[0].priceCents,
        cardPolicy: { mode: "products", hint: "从products推荐，正文点到的每件都输出对应商品标记。" },
        nextAction: reminders.length
          ? `直接推荐并输出products标记：说出具体版型和效果（如「宽松直筒版型，很显瘦，符合你要的」），结尾加一句提醒：${reminders.join("；")}。不要对顾客说「标签」「商品标注了」「资料」这类系统用语，也不要说「没有完全匹配」。`
          : "直接推荐并输出products标记：说出具体版型和效果（如「宽松直筒版型，很显瘦，符合你要的」），再问一句喜不喜欢。不要对顾客说「标签」「商品标注了」「资料」这类系统用语。",
      };
    }
    return { ...base, status: "needs_verification", unresolvedRequirements: stillUnresolved,
      nearest,
      budgetAssessment: (budget === null || overByCents === null) ? null
        : { minimumPriceCents: minimumPriceCents!, budgetCents: budget, overByCents },
      nextAction: stillUnresolved.length === 0
        ? "按【收尾规则·唯一版本】处理nearest；satisfied里的「符合XX」「版型依据」是已核实的商品特点，推荐时自然地说出效果（如「宽松直筒版型，很显瘦，符合你要的显瘦」），不要对顾客说「标签」「商品标注了」「资料」这类系统用语。"
        : `按【收尾规则·唯一版本】处理nearest；unresolvedRequirements逐条说成「暂时无法核实」，不得说成已满足。satisfied里的「符合XX」「版型依据」是已核实的商品特点，推荐时自然地说出效果（如「宽松直筒版型，很显瘦，符合你要的显瘦」），不要对顾客说「标签」「商品标注了」「资料」这类系统用语；由资料核实、顾客没有异议的小条件（如预算）不算「差的地方」。${base.soldOut.length ? "先如实说明soldOut里这些款式店里有但已售罄（不得说成没有这款）。" : ""}` };
  }

  const { styles, occasions: styleOccasions } = splitStyleAndOccasion(requirements.styleTags);
  const allOccasions = [...new Set([...styleOccasions, ...occasions])];
  const where: Prisma.ProductWhereInput = {
    status: "ON_SALE", stock: { gt: 0 }, category: { slug: requirements.category },
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
  const checkedConstraints = ["在售且库存大于零", "品类", "正向关键词",
    ...(styles.length ? ["全部明确风格标签"] : []),
    ...(occasions.length ? [`适用场合：${occasions.join("、")}`] : []), "已识别的排除品类",
    ...(requirements.budgetCents === null ? [] : ["单件预算"])];
  const products = candidates.filter((p) => requirements.budgetCents === null || p.priceCents <= requirements.budgetCents)
    .slice(0, limit).map(toCatalogProduct);
  if (products.length) {
    const noStylePreference = hasNoStylePreference(requirements.q);
    // Give the model the remainder as data so it rewrites "还剩 XX 元" verbatim
    // instead of re-deriving (and paraphrasing) the subtraction itself.
    const budgetRemainderCents = requirements.budgetCents === null ? null : requirements.budgetCents - products[0].priceCents;
    return { ...base, checkedConstraints, status: "matched_known_constraints", products, budgetRemainderCents,
      ...(noStylePreference ? { noStylePreference: true } : {}),
      nextAction: budgetRemainderCents === null
        ? "从products中推荐单品，报价和商品ID取真实字段；仅声称已核对条件匹配，不把查询结果当作页面上下文。"
        : "从products中推荐单品，报价和商品ID取真实字段，并按budgetRemainderCents用「预算还剩XX元」的句式说明剩余额度，不得改写为「还差」「还欠」等其他含义；仅声称已核对条件匹配，不把查询结果当作页面上下文。" };
  }
  if (candidates.length && requirements.budgetCents !== null) {
    const minimumPriceCents = candidates[0].priceCents;
    const overByCents = minimumPriceCents - requirements.budgetCents;
    return { ...base, checkedConstraints, status: "over_budget",
      // D01-1: return the over-budget item itself so the answer node can name it and
      // emit its marker; the rule still forbids presenting it as a recommendation.
      nearest: [toNearest(toCatalogProduct(candidates[0]), checkedNames(styles, allOccasions),
        [{ field: "budget", text: budgetViolationText(overByCents) }], "over_budget")],
      budgetAssessment: { minimumPriceCents, budgetCents: requirements.budgetCents, overByCents },
      nextAction: "按【收尾规则·唯一版本】处理nearest；超出金额以budgetAssessment.overByCents为准。顾客尚未同意前不得提高预算。" };
  }
  // 顾客问的款式如果存在但已售罄，要把它带出来并如实说明「有这款但售罄」，
  // 不能只说「没有匹配」，让顾客以为店里从没进过。售罄商品只作说明，不进 nearest 的推荐位。
  const soldOut = await findSoldOutByTokens(reader, requirements);
  // 「最接近」的判断顺序：先按 q 点名的款式家族收窄；再按顾客明确要求的风格/场合收窄
  // （「复古裤子」没有复古裤、但有复古裙，裙子就是最接近的那件）；都不行才退回同品类在售。
  // 每一级的差异都逐条写进 violations 交给回答节点，不在这里拼话术。
  const familyTerms = wantedFamilies(requirements.q);
  const sameFamily = familyTerms.length
    ? candidates.filter((item) => familyTerms.some((terms) => familyMatches(item, terms)))
    : candidates;
  const narrowest = [...sameFamily, ...candidates].slice(0, Math.max(limit, 8));
  const catalogue = await reader.findMany({
    where: { status: "ON_SALE", stock: { gt: 0 }, category: { slug: requirements.category } },
    select: catalogProductSelect, orderBy, take: Math.max(limit, 8) * 3,
  });
  const ranked = [
    ...narrowest,
    ...catalogue.filter((item) => !narrowest.some((seen) => seen.id === item.id)),
    ...candidates,
  ];
  const score = (item: CatalogProduct) =>
    (familyTerms.some((terms) => familyMatches(item, terms)) ? 0 : 4) +
    styles.filter((style) => !item.styleTags.includes(style)).length +
    allOccasions.filter((occasion) => !item.occasionTags.includes(occasion)).length;
  const nearest = [...new Map(ranked.map((item) => [item.id, item])).values()]
    .sort((a, b) => score(a) - score(b) || a.priceCents - b.priceCents)
    .slice(0, limit)
    .map((item) => {
      // 风格无所谓时，同类在售商品不是「最接近」，而是可推荐的备选替换。
      const noStylePreference = hasNoStylePreference(requirements.q);
      const violations: { field: string; text: string }[] = [
        ...(familyTerms.length && !familyTerms.some((terms) => familyMatches(item, terms))
          ? [{ field: "keyword", text: "款式不对：不是顾客指定的那一类" }] : []),
        ...missingTagViolations(item, styles, allOccasions),
      ];
      return { ...toNearest(toCatalogProduct(item), checkedNames(styles, allOccasions), violations, "no_match"),
        ...(noStylePreference ? { alternativesRecommended: true } : {}) };
    });
  return { ...base, checkedConstraints, status: "no_match_for_query", nearest,
    soldOut: soldOut.map(({ name, category }) => ({ name, category: category.name })),
    nextAction: soldOut.length
      ? "先如实说明soldOut里这些款式店里有但已售罄（不得说成没有这款），再按【收尾规则·唯一版本】处理nearest。"
      : nearest.length
      ? "按【收尾规则·唯一版本】处理nearest。"
      : "说明按本次已记录条件暂未查到匹配，不扩大成全店无货；必要时只协商一个条件。" };
}

// 按关键词（2~4 字）和商品名互相包含来识别「顾客问的款式」，
// 整句严格匹配会漏掉「有复古乐福鞋吗」这种带问句的写法。
async function findSoldOutByTokens(reader: CatalogReader, requirements: AssistantRequirements): Promise<CatalogProduct[]> {
  const text = requirements.q.trim();
  if (text.length < 2) return [];
  const grams = new Set<string>();
  const chars = Array.from(text);
  for (let size = 2; size <= Math.min(4, chars.length); size += 1) {
    for (let index = 0; index + size <= chars.length; index += 1) grams.add(chars.slice(index, index + size).join(""));
  }
  const sold = await reader.findMany({
    where: { status: "SOLD", ...(requirements.category ? { category: { slug: requirements.category } } : {}) },
    select: catalogProductSelect, orderBy: [{ priceCents: "asc" }, { id: "asc" }], take: 20,
  });
  return sold.filter((product) => {
    if (product.name.includes(text)) return true;
    let hits = 0;
    for (let index = 0; index + 2 <= product.name.length; index += 1) {
      if (grams.has(product.name.slice(index, index + 2))) hits += 1;
    }
    return hits >= 2;
  }).slice(0, 2);
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
