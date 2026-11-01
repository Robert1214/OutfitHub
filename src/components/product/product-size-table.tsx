import type { ProductDetail } from "@/lib/products";

const fitLabel: Record<NonNullable<ProductDetail["fitType"]>, string> = {
  SLIM: "紧身",
  REGULAR: "合身",
  LOOSE: "宽松",
};

export function ProductSizeTable({ product }: { product: ProductDetail }) {
  if (product.refType !== "GARMENT") {
    return (
      <p className="text-sm text-muted-foreground">
        该品类不提供成衣尺寸，请以实物为准。
      </p>
    );
  }

  const isBottom = product.category.slug === "bottoms";
  const rows = isBottom
    ? [
        { label: "腰围", value: product.waistCm },
        { label: "臀围", value: product.hipCm },
        { label: "裤长/裙长", value: product.pantsLengthCm },
      ]
    : [
        { label: "胸围", value: product.chestCm },
        { label: "衣长", value: product.lengthCm },
        { label: "肩宽", value: product.shoulderCm },
      ];

  return (
    <div className="space-y-2">
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {rows.map((row) => (
          <div
            key={row.label}
            className="rounded-lg border bg-muted/30 px-3 py-2"
          >
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="mt-1 font-medium">
              {row.value !== null ? `${row.value} cm` : "—"}
            </dd>
          </div>
        ))}
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <dt className="text-xs text-muted-foreground">版型</dt>
          <dd className="mt-1 font-medium">
            {product.fitType ? fitLabel[product.fitType] : "—"}
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        店主手工测量，仅供参考。
      </p>
    </div>
  );
}
