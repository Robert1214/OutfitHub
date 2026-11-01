import { z } from "zod";
import type { ProductListParams } from "@/lib/products";

export type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

const querySchema = z.object({
  q: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100).optional().catch(undefined),
  ),
  category: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(100).optional().catch(undefined),
  ),
  color: z.preprocess(
    emptyToUndefined,
    z.string().trim().max(50).optional().catch(undefined),
  ),
  fitType: z.preprocess(
    emptyToUndefined,
    z
      .enum(["SLIM", "REGULAR", "LOOSE"])
      .optional()
      .catch(undefined),
  ),
  minPrice: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .nonnegative()
      .max(100000)
      .optional()
      .catch(undefined),
  ),
  maxPrice: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .nonnegative()
      .max(100000)
      .optional()
      .catch(undefined),
  ),
  sort: z.preprocess(
    emptyToUndefined,
    z
      .enum(["newest", "price_asc", "price_desc"])
      .optional()
      .catch(undefined),
  ),
  page: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .int()
      .positive()
      .max(1000)
      .optional()
      .catch(undefined),
  ),
  includeSold: z.preprocess(
    emptyToUndefined,
    z.literal("1").optional().catch(undefined),
  ),
});

export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseProductListParams(
  raw: RawSearchParams,
): ProductListParams {
  const input = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, firstParam(value)]),
  );
  const parsed = querySchema.safeParse(input);
  const data = parsed.success ? parsed.data : {};

  let minPrice = data.minPrice;
  let maxPrice = data.maxPrice;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    [minPrice, maxPrice] = [maxPrice, minPrice];
  }

  return {
    q: data.q,
    category: data.category,
    color: data.color,
    fitType: data.fitType,
    minPriceCents:
      minPrice !== undefined ? Math.round(minPrice * 100) : undefined,
    maxPriceCents:
      maxPrice !== undefined ? Math.round(maxPrice * 100) : undefined,
    sort: data.sort ?? "newest",
    page: data.page ?? 1,
    includeSold: data.includeSold === "1",
  };
}

export function buildProductsHref(
  raw: RawSearchParams,
  overrides: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  for (const key of [
    "q",
    "category",
    "color",
    "fitType",
    "minPrice",
    "maxPrice",
    "sort",
    "includeSold",
  ]) {
    const value = firstParam(raw[key]);
    if (value) params.set(key, value);
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();
  return queryString ? `/products?${queryString}` : "/products";
}
