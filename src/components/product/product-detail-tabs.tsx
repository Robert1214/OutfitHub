"use client";

import Image from "next/image";
import { ProductCard } from "@/components/product/product-card";
import { ProductSizeTable } from "@/components/product/product-size-table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { ProductCardData, ProductDetail } from "@/lib/products";

const refTypeLabel: Record<ProductDetail["refType"], string> = {
  GARMENT: "服装",
  ACCESSORIES: "配饰",
  SHOES: "鞋履",
};

const fitLabel: Record<NonNullable<ProductDetail["fitType"]>, string> = {
  SLIM: "紧身",
  REGULAR: "合身",
  LOOSE: "宽松",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-4 border-b py-3 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right sm:text-left">{value}</dd>
    </div>
  );
}

export function ProductDetailTabs({
  product,
  recommendations,
}: {
  product: ProductDetail;
  recommendations: ProductCardData[];
}) {
  return (
    <Tabs defaultValue="params" className="mt-8 gap-0">
      <div className="sticky top-14 z-30 -mx-4 border-b bg-background/95 px-4 backdrop-blur sm:top-16">
        <TabsList
          variant="line"
          className="h-11 w-full justify-start gap-6 overflow-x-auto rounded-none p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsTrigger
            value="params"
            className="h-11 flex-none px-0 after:bottom-0"
          >
            参数信息
          </TabsTrigger>
          <TabsTrigger
            value="size"
            className="h-11 flex-none px-0 after:bottom-0"
          >
            尺码信息
          </TabsTrigger>
          <TabsTrigger
            value="detail"
            className="h-11 flex-none px-0 after:bottom-0"
          >
            图文详情
          </TabsTrigger>
          <TabsTrigger
            value="recommend"
            className="h-11 flex-none px-0 after:bottom-0"
          >
            本店推荐
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="params" className="pt-6">
        <div className="rounded-xl border px-4">
          <dl className="text-sm">
            <InfoRow label="品类" value={product.category.name} />
            <InfoRow label="类型" value={refTypeLabel[product.refType]} />
            <InfoRow label="颜色" value={product.color} />
            <InfoRow label="尺码标签" value={product.sizeLabel ?? "—"} />
            {product.refType === "GARMENT" ? (
              <InfoRow
                label="版型"
                value={product.fitType ? fitLabel[product.fitType] : "—"}
              />
            ) : null}
            <InfoRow label="材质" value={product.material ?? "—"} />
            <InfoRow label="护理" value={product.careInstructions ?? "—"} />
            <InfoRow
              label="标签"
              value={
                product.tags.length > 0
                  ? product.tags.map((tag) => `#${tag}`).join(" ")
                  : "—"
              }
            />
          </dl>
        </div>
      </TabsContent>

      <TabsContent value="size" className="pt-6">
        <div className="rounded-xl border bg-muted/20 p-4">
          <ProductSizeTable product={product} />
        </div>
      </TabsContent>

      <TabsContent value="detail" className="pt-6">
        <div className="space-y-6">
          <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">
            {product.description}
          </p>
          <div className="space-y-4">
            {product.images.map((image, index) => (
              <div
                key={image.url}
                className="relative aspect-[4/5] overflow-hidden rounded-xl border bg-muted"
              >
                <Image
                  src={image.url}
                  alt={`${product.name} 详情图 ${index + 1}`}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      <TabsContent value="recommend" className="pt-6">
        {recommendations.length > 0 ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8">
            {recommendations.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无推荐商品。</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
