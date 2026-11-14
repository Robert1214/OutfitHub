import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { allowRateLimit } from "@/lib/rate-limit";
import { assistantRequirementsSchema } from "@/lib/assistant-requirements";
import { queryCatalogProducts } from "@/lib/assistant-catalog";
import { queryAnchoredOutfits } from "@/lib/assistant-outfits";
import { ownerReviewedComparisonCatalog } from "@/lib/assistant-comparisons";

const catalogQuerySchema = z.object({
  requirements: z.string().min(1).max(8000),
  limit: z.coerce.number().int().min(1).max(4).default(4),
  contextProductId: z.string().trim().max(50).optional(),
}).strict();

const querySchema = z.object({
  // Dify 参数提取节点可能把 <think> 推理一起带进 q；
  // 这里放宽长度，真正的关键词由 sanitizeQuery 清洗后再用。
  q: z.string().trim().max(8000).optional(),
  category: z.string().trim().max(50).optional(),
  color: z.string().trim().max(30).optional(),
  refType: z.enum(["GARMENT", "ACCESSORIES", "SHOES"]).optional(),
  styleTags: z.string().trim().max(300).optional(),
  occasionTags: z.string().trim().max(300).optional(),
  minPriceCents: z.coerce.number().int().min(0).optional(),
  maxPriceCents: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(12).default(8),
  ids: z.string().trim().max(1000).optional(),
  similarTo: z.string().trim().max(50).optional(),
  contextProductId: z.string().trim().max(50).optional(),
});

const productSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  material: true,
  status: true,
  priceCents: true,
  color: true,
  sizeLabel: true,
  refType: true,
  categoryId: true,
  tags: true,
  styleTags: true,
  occasionTags: true,
  returnPolicy: true,
  category: { select: { name: true, slug: true } },
  images: {
    orderBy: { sortOrder: "asc" },
    take: 1,
    select: { url: true },
  },
} satisfies Prisma.ProductSelect;

type ToolProduct = Prisma.ProductGetPayload<{
  select: typeof productSelect;
}>;

function toToolProduct(product: ToolProduct) {
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    priceCents: product.priceCents,
    color: product.color,
    sizeLabel: product.sizeLabel,
    refType: product.refType,
    status: product.status,
    categoryName: product.category.name,
    categorySlug: product.category.slug,
    tags: product.tags,
    styleTags: product.styleTags,
    occasionTags: product.occasionTags,
    returnPolicy: product.returnPolicy,
    imageUrl: product.images[0]?.url ?? null,
  };
}

function readToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  if (authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }
  return request.headers.get("x-assistant-token")?.trim() ?? "";
}

function sameToken(actual: string, expected: string): boolean {
  if (!actual || !expected) return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Dify 的推理模型可能把 `<think>...</think>` 连同关键词
 * 一起写进 HTTP 查询参数；这里先清洗，避免 400 和无效搜索。
 */
function sanitizeQuery(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    // 有些模型只输出 `<think>` 不输出闭合标签，此时不能把推理内容当关键词。
    .replace(/<think>[\s\S]*$/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  const tail = cleaned.slice(-80).trim();
  return tail || undefined;
}

function splitTags(value: string | undefined): string[] {
  if (!value) return [];
  return [
    ...new Set(
      value
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);
}

/**
 * 商品搜索是「短关键词」而不是 SQL 精确匹配。
 * Dify 提取的关键词可能是「通勤外套」「显瘦裤」「女鞋」，
 * 数据库里对应的却是 category / tags 的组合，所以这里做一层轻量模糊评分。
 */
const CATEGORY_SYNONYMS: Array<{ terms: string[]; slugs: string[] }> = [
  { terms: ["鞋", "女鞋", "男鞋", "鞋履"], slugs: ["shoes"] },
  { terms: ["裙", "裙子", "连衣裙"], slugs: ["dresses", "bottoms"] },
  { terms: ["裤", "裤子", "下装"], slugs: ["bottoms"] },
  { terms: ["上装", "上衣", "针织", "衬衫", "背心"], slugs: ["tops"] },
  { terms: ["外套", "大衣", "风衣"], slugs: ["outerwear"] },
  { terms: ["配饰", "包", "耳环", "腰带"], slugs: ["accessories"] },
];

const SINGLE_CHAR_HINTS = new Set(
  ["裙", "裤", "鞋", "衣", "包", "帽", "耳", "带", "风", "毛", "针", "牛", "帆"],
);

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s,，。！？、；：""''（）()【】\[\]!?.;:]/g, "");
}

function normalizeQueryText(value: string): string {
  return normalizeText(value)
    .replaceAll("vintage", "复古")
    .replaceAll("古着", "复古");
}

function categorySlugsForQuery(query: string): string[] {
  const normalized = normalizeQueryText(query);
  const slugs = new Set<string>();
  for (const group of CATEGORY_SYNONYMS) {
    if (group.terms.some((term) => normalized.includes(term))) {
      for (const slug of group.slugs) slugs.add(slug);
    }
  }
  return [...slugs];
}

function queryTokens(query: string): string[] {
  const chars = Array.from(normalizeQueryText(query));
  const tokens = new Set<string>();

  for (const char of chars) {
    if (SINGLE_CHAR_HINTS.has(char)) tokens.add(char);
  }

  for (let size = 2; size <= Math.min(4, chars.length); size += 1) {
    for (let index = 0; index <= chars.length - size; index += 1) {
      tokens.add(chars.slice(index, index + size).join(""));
    }
  }

  return [...tokens].slice(0, 80);
}

function scoreProduct(
  product: ToolProduct,
  query: string,
  preferredCategorySlugs: string[],
): number {
  const normalizedQuery = normalizeQueryText(query);
  if (!normalizedQuery) return 0;

  const normalizedName = normalizeText(product.name);
  const normalizedCategory = normalizeText(product.category.name);
  const normalizedColor = normalizeText(product.color);
  const normalizedDescription = normalizeText(product.description ?? "");
  const tags = [
    ...product.tags,
    ...product.styleTags,
    ...product.occasionTags,
  ];

  let score = 0;

  if (normalizedName === normalizedQuery) score += 200;
  else if (
    normalizedName.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedName)
  ) {
    score += 80;
  }

  if (
    normalizedCategory.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedCategory)
  ) {
    score += 40;
  }

  if (preferredCategorySlugs.includes(product.category.slug)) score += 35;

  for (const tag of tags) {
    const normalizedTag = normalizeText(tag);
    if (normalizedTag === normalizedQuery) score += 30;
    else if (
      normalizedTag.includes(normalizedQuery) ||
      normalizedQuery.includes(normalizedTag)
    ) {
      score += 15;
    }
  }

  if (
    normalizedColor.includes(normalizedQuery) ||
    normalizedQuery.includes(normalizedColor)
  ) {
    score += 20;
  }

  if (normalizedDescription.includes(normalizedQuery)) score += 20;

  const haystack = normalizeText(
    [
      product.name,
      product.description ?? "",
      product.material ?? "",
      product.color,
      product.category.name,
      ...tags,
    ].join(" "),
  );

  for (const token of queryTokens(query)) {
    if (token.length >= 2 && haystack.includes(token)) {
      score += Math.min(12, token.length * 4);
    }
  }

  return score;
}

async function findSoldExact(query: string): Promise<ToolProduct[]> {
  const normalizedQuery = normalizeText(query);
  if (normalizedQuery.length < 3) return [];

  const sold = await prisma.product.findMany({
    where: { status: "SOLD" },
    select: productSelect,
    take: 20,
  });

  return sold
    .filter((product) => {
      const normalizedName = normalizeText(product.name);
      return (
        normalizedName === normalizedQuery ||
        normalizedName.includes(normalizedQuery) ||
        normalizedQuery.includes(normalizedName)
      );
    })
    .slice(0, 1);
}

async function findSoldWithAlternatives(
  query: string,
  limit: number,
): Promise<ToolProduct[]> {
  const sold = await findSoldExact(query);
  if (sold.length === 0) return [];

  const alternatives = await prisma.product.findMany({
    where: {
      status: "ON_SALE",
      categoryId: sold[0].categoryId,
      id: { not: sold[0].id },
    },
    select: productSelect,
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(0, limit - sold.length),
  });

  return [...sold, ...alternatives];
}

async function findSimilarProducts(
  targetId: string,
  limit: number,
): Promise<ToolProduct[] | null> {
  const target = await prisma.product.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      categoryId: true,
      color: true,
      styleTags: true,
      occasionTags: true,
    },
  });
  if (!target) return null;

  // 相似款不考虑预算：同品类 + 风格/场合重叠排序。
  const candidates = await prisma.product.findMany({
    where: {
      id: { not: target.id },
      status: "ON_SALE",
      OR: [
        { categoryId: target.categoryId },
        ...(target.styleTags.length > 0
          ? [{ styleTags: { hasSome: target.styleTags } }]
          : []),
        ...(target.occasionTags.length > 0
          ? [{ occasionTags: { hasSome: target.occasionTags } }]
          : []),
      ],
    },
    select: productSelect,
    take: 24,
  });

  return candidates
    .map((candidate) => {
      const styleOverlap = candidate.styleTags.filter((tag) =>
        target.styleTags.includes(tag),
      ).length;
      const occasionOverlap = candidate.occasionTags.filter((tag) =>
        target.occasionTags.includes(tag),
      ).length;
      const score =
        (candidate.categoryId === target.categoryId ? 3 : 0) +
        styleOverlap * 2 +
        occasionOverlap +
        (candidate.color === target.color ? 1 : 0);
      return { candidate, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidate.priceCents ?? 0) - (b.candidate.priceCents ?? 0),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

const OUTFIT_COMPLEMENTS: Record<string, string[]> = {
  tops: ["bottoms", "shoes", "accessories"],
  bottoms: ["tops", "outerwear", "shoes", "accessories"],
  dresses: ["outerwear", "shoes", "accessories"],
  outerwear: ["tops", "bottoms", "shoes", "accessories"],
  accessories: ["tops", "bottoms", "dresses", "shoes"],
  shoes: ["bottoms", "dresses", "outerwear", "accessories"],
};

async function findOutfitProducts(
  targetId: string,
  limit: number,
): Promise<ToolProduct[] | null> {
  const target = await prisma.product.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      categoryId: true,
      color: true,
      styleTags: true,
      occasionTags: true,
      category: { select: { slug: true } },
    },
  });
  if (!target) return null;

  const categorySlugs = OUTFIT_COMPLEMENTS[target.category.slug] ?? [];
  const candidates = await prisma.product.findMany({
    where: {
      status: "ON_SALE",
      id: { not: target.id },
      ...(categorySlugs.length > 0
        ? { category: { slug: { in: categorySlugs } } }
        : {}),
    },
    select: productSelect,
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  const categoryBonus = new Map(
    categorySlugs.map((slug, index) => [slug, categorySlugs.length - index]),
  );

  return candidates
    .map((candidate) => {
      const styleOverlap = candidate.styleTags.filter((tag) =>
        target.styleTags.includes(tag),
      ).length;
      const occasionOverlap = candidate.occasionTags.filter((tag) =>
        target.occasionTags.includes(tag),
      ).length;
      const score =
        styleOverlap * 3 +
        occasionOverlap * 2 +
        (categoryBonus.get(candidate.category.slug) ?? 0) +
        (candidate.color === target.color ? 1 : 0);
      return { candidate, score };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidate.priceCents ?? 0) - (b.candidate.priceCents ?? 0),
    )
    .slice(0, limit)
    .map(({ candidate }) => candidate);
}

const FRIENDLY_COLOR_SCORE: Array<{ term: string; score: number }> = [
  { term: "驼", score: 8 },
  { term: "米白", score: 6 },
  { term: "奶油白", score: 6 },
  { term: "米色", score: 5 },
  { term: "灰", score: 6 },
  { term: "牛仔", score: 6 },
  { term: "白", score: 4 },
  { term: "棕", score: 3 },
  { term: "黑", score: 2 },
];

const NEUTRAL_STYLE_TAGS = new Set([
  "基础",
  "极简",
  "温柔",
  "经典",
  "中性",
  "简约",
  "大气",
]);

async function findColorFriendlyProducts(limit: number): Promise<ToolProduct[]> {
  const candidates = await prisma.product.findMany({
    where: { status: "ON_SALE" },
    select: productSelect,
    orderBy: [{ createdAt: "desc" }],
    take: 100,
  });

  const scored = candidates
    .map((candidate) => {
      const color = normalizeText(candidate.color);
      const colorScore = FRIENDLY_COLOR_SCORE.reduce(
        (score, item) => (color.includes(normalizeText(item.term)) ? score + item.score : score),
        0,
      );
      const styleScore = candidate.styleTags.filter((tag) =>
        NEUTRAL_STYLE_TAGS.has(tag),
      ).length * 2;
      return { candidate, score: colorScore + styleScore };
    })
    .filter((item) => item.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (a.candidate.priceCents ?? 0) - (b.candidate.priceCents ?? 0),
    );

  // 肤色建议最多展示 4 件：上衣 2、外套 1、下装 1。
  // 与回答 Prompt 的「最多推荐 4 件」保持一致，避免工具给 5 件、
  // 模型只能挑 4 件时漏掉其中一件。
  const colorLimit = Math.min(limit, 4);
  const selected: ToolProduct[] = [];
  const used = new Set<string>();
  const take = (predicate: (product: ToolProduct) => boolean, count: number) => {
    for (const item of scored) {
      if (selected.length >= colorLimit) return;
      if (count <= 0) return;
      if (used.has(item.candidate.id)) continue;
      if (!predicate(item.candidate)) continue;
      used.add(item.candidate.id);
      selected.push(item.candidate);
      count -= 1;
    }
  };

  take((product) => product.category.slug === "tops", 2);
  take((product) => product.category.slug === "outerwear", 1);
  take((product) => product.category.slug === "bottoms", 1);

  for (const item of scored) {
    if (selected.length >= colorLimit) break;
    if (used.has(item.candidate.id)) continue;
    used.add(item.candidate.id);
    selected.push(item.candidate);
  }

  return selected.slice(0, colorLimit);
}

function priceFilter(
  minPriceCents: number | undefined,
  maxPriceCents: number | undefined,
): Prisma.IntFilter | undefined {
  if (minPriceCents === undefined && maxPriceCents === undefined) {
    return undefined;
  }
  return {
    ...(minPriceCents !== undefined ? { gte: minPriceCents } : {}),
    ...(maxPriceCents !== undefined ? { lte: maxPriceCents } : {}),
  };
}

function buildWhere(params: {
  q?: string;
  category?: string;
  color?: string;
  refType?: "GARMENT" | "ACCESSORIES" | "SHOES";
  styleTags: string[];
  occasionTags: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  ids: string[];
}): Prisma.ProductWhereInput {
  if (params.ids.length > 0) {
    return {
      status: "ON_SALE",
      id: { in: params.ids },
    };
  }

  const where: Prisma.ProductWhereInput = { status: "ON_SALE" };
  if (params.category) where.category = { slug: params.category };
  if (params.color) where.color = params.color;
  if (params.refType) where.refType = params.refType;
  if (params.styleTags.length > 0) {
    where.styleTags = { hasSome: params.styleTags };
  }
  if (params.occasionTags.length > 0) {
    where.occasionTags = { hasSome: params.occasionTags };
  }
  const prices = priceFilter(params.minPriceCents, params.maxPriceCents);
  if (prices) where.priceCents = prices;

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { description: { contains: params.q, mode: "insensitive" } },
      { tags: { has: params.q } },
      { styleTags: { has: params.q } },
      { occasionTags: { has: params.q } },
    ];
  }

  return where;
}

/**
 * 搭配分支的金额口径：单件预算且不计上衣时，回答节点必须只报本次新买下装的金额。
 * 工具已经算好 reportedPriceCents，但模型仍可能照抄 outfits 里的整套合计，
 * 因此在响应体顶层再给一个显式、不可误解的「本次应报金额」与一句口径说明。
 */
function annotateOutfitPurchaseBasis<T extends { purchaseBasis?: string; reportedPriceCents?: number | null }>(result: T) {
  if (result.purchaseBasis !== "newItemsOnly" || result.reportedPriceCents == null) return result;
  return {
    ...result,
    priceBasisNote: `本次只购买下装：所有金额以本次应报金额${result.reportedPriceCents}分为准，不得把搭配主体（已有上衣）的金额计入本次总价或合计。`,
  };
}

export async function GET(request: Request) {  const expectedToken = process.env.ASSISTANT_TOOL_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json(
      { error: "助手商品工具未配置" },
      { status: 503 },
    );
  }
  if (!sameToken(readToken(request), expectedToken)) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "local";
  if (!allowRateLimit(`assistant-products:${ip}`, 60, 60_000)) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      { status: 429 },
    );
  }

  const url = new URL(request.url);
  // An explicit requirements request never falls back to legacy keyword branches.
  if (url.searchParams.has("requirements")) {
    const catalogQuery = catalogQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    const keys = [...url.searchParams.keys()];
    if (!catalogQuery.success || new Set(keys).size !== keys.length) {
      return NextResponse.json({ error: "完整需求查询只接受requirements、limit和contextProductId，请检查节点参数" }, { status: 400 });
    }
    let decoded: unknown;
    try { decoded = JSON.parse(catalogQuery.data.requirements); } catch {
      return NextResponse.json({ error: "requirements不是有效JSON，未执行商品查询" }, { status: 400 });
    }
    const requirements = assistantRequirementsSchema.safeParse(decoded);
    if (!requirements.success) {
      return NextResponse.json({ error: "需求字段缺失、类型或预算范围不正确，未执行商品查询" }, { status: 400 });
    }
    try {
      const result = requirements.data.intent === "outfit"
        ? await queryAnchoredOutfits(requirements.data, prisma.product, catalogQuery.data.contextProductId, catalogQuery.data.limit)
        : requirements.data.intent === "comparison"
          // 比较模式只返回店主审核过的固定比较组，不查数据库、不生成商品ID。
          ? ownerReviewedComparisonCatalog
          : await queryCatalogProducts(requirements.data, prisma.product, catalogQuery.data.limit);
      const body = result.scope === "catalog_anchored_outfit"
        ? annotateOutfitPurchaseBasis(result)
        : result;
      return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
    } catch {
      console.error("完整需求商品查询失败");
      return NextResponse.json({ error: "商品查询失败，请稍后重试" }, { status: 500 });
    }
  }
  const parsed = querySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    category: url.searchParams.get("category") ?? undefined,
    color: url.searchParams.get("color") ?? undefined,
    refType: url.searchParams.get("refType") ?? undefined,
    styleTags: url.searchParams.get("styleTags") ?? undefined,
    occasionTags: url.searchParams.get("occasionTags") ?? undefined,
    minPriceCents: url.searchParams.get("minPriceCents") ?? undefined,
    maxPriceCents: url.searchParams.get("maxPriceCents") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
    ids: url.searchParams.get("ids") ?? undefined,
    similarTo: url.searchParams.get("similarTo") ?? undefined,
    contextProductId: url.searchParams.get("contextProductId") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "商品查询参数不正确" },
      { status: 400 },
    );
  }

  const {
    q,
    category,
    color,
    refType,
    styleTags,
    occasionTags,
    minPriceCents,
    maxPriceCents,
    limit,
    ids,
    similarTo,
    contextProductId,
  } = parsed.data;
  const idList = ids
    ? [...new Set(ids.split(",").map((id) => id.trim()).filter(Boolean))].slice(
        0,
        20,
      )
    : [];
  const searchQuery = sanitizeQuery(q);

  try {
    if (similarTo) {
      const products = await findSimilarProducts(similarTo, limit);
      if (!products) {
        return NextResponse.json(
          { error: "相似商品基准不存在" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        products: products.map(toToolProduct),
      });
    }

    const normalizedQuery = searchQuery ? normalizeText(searchQuery) : "";
    const hasSimilarIntent =
      normalizedQuery.length > 0 &&
      ["相似", "同款", "类似", "差不多", "像"].some((hint) =>
        normalizedQuery.includes(hint),
      );
    const hasOutfitIntent =
      normalizedQuery.length > 0 &&
      ["搭配", "穿搭", "配什么", "怎么穿", "一套", "配一", "配个", "配双"].some(
        (hint) => normalizedQuery.includes(hint),
      );
    const hasColorIntent =
      normalizedQuery.length > 0 &&
      [
        "显白",
        "显黑",
        "肤色",
        "黑黄",
        "颜色",
        "冷皮",
        "暖皮",
        "中性皮",
        "白皮",
        "黄皮",
        "黑皮",
        "冷色系",
        "暖色系",
        "冷色调",
        "暖色调",
        "雾霾蓝",
        "藏蓝",
        "冷白",
        "烟灰",
        "卡其",
        "浅棕",
        "焦糖",
        "橘红",
        "姜黄",
        "杏色",
        "暖粉",
        "冰蓝",
        "浅紫",
        "莓红",
        "薄荷绿",
        "墨绿",
      ].some((hint) => normalizedQuery.includes(hint));

    if (contextProductId && hasSimilarIntent) {
      const products = await findSimilarProducts(contextProductId, limit);
      if (products) {
        return NextResponse.json({
          products: products.map(toToolProduct),
        });
      }
    }

    if (contextProductId && hasOutfitIntent) {
      const products = await findOutfitProducts(contextProductId, limit);
      if (products) {
        return NextResponse.json({
          products: products.map(toToolProduct),
        });
      }
    }

    if (!contextProductId && hasColorIntent) {
      const products = await findColorFriendlyProducts(limit);
      return NextResponse.json({
        products: products.map(toToolProduct),
      });
    }

    const styleTagList = splitTags(styleTags);
    const occasionTagList = splitTags(occasionTags);
    const candidateWhere = buildWhere({
      category,
      color,
      refType,
      styleTags: styleTagList,
      occasionTags: occasionTagList,
      minPriceCents,
      maxPriceCents,
      ids: idList,
    });

    if (idList.length > 0 || !searchQuery) {
      const products = await prisma.product.findMany({
        where: candidateWhere,
        orderBy: [{ createdAt: "desc" }],
        take: limit,
        select: productSelect,
      });
      return NextResponse.json({ products: products.map(toToolProduct) });
    }

    const candidates = await prisma.product.findMany({
      where: candidateWhere,
      orderBy: [{ createdAt: "desc" }],
      take: 100,
      select: productSelect,
    });

    const preferredCategorySlugs = categorySlugsForQuery(searchQuery);
    const scored = candidates
      .map((candidate) => ({
        candidate,
        score: scoreProduct(candidate, searchQuery, preferredCategorySlugs),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.candidate.name.localeCompare(b.candidate.name, "zh-CN"),
      );

    // 只有用户明确问某个售罄商品时，才把 SOLD 商品带回来；
    // 普通推荐仍然只返回 ON_SALE，避免把已售出的孤品当推荐。
    const canCheckSold =
      !category &&
      !color &&
      !refType &&
      styleTagList.length === 0 &&
      occasionTagList.length === 0 &&
      minPriceCents === undefined &&
      maxPriceCents === undefined;
    const soldResults = canCheckSold
      ? await findSoldWithAlternatives(searchQuery, limit)
      : [];

    const results: ToolProduct[] = [];
    const seen = new Set<string>();
    for (const product of [
      ...soldResults,
      ...scored.map((item) => item.candidate),
    ]) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      results.push(product);
      if (results.length >= limit) break;
    }

    return NextResponse.json({
      products: results.map(toToolProduct),
    });
  } catch (error) {
    console.error(
      "助手商品查询失败：",
      error instanceof Error ? error.message : "unknown",
    );
    return NextResponse.json(
      { error: "商品查询失败，请稍后重试" },
      { status: 500 },
    );
  }
}
