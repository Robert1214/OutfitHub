import Link from "next/link";
import { Suspense } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";

async function HomeStats() {
  const [productCount, onSaleCount, categoryCount, imageCount] =
    await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: "ON_SALE" } }),
      prisma.category.count(),
      prisma.productImage.count(),
    ]);

  return (
    <>
      <section className="grid gap-4 pb-16 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>商品总数</CardDescription>
            <CardTitle className="text-3xl">{productCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            孤品库存，每件仅 1 件
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>在售商品</CardDescription>
            <CardTitle className="text-3xl">{onSaleCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            售罄商品默认不在推荐位展示
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>商品分类</CardDescription>
            <CardTitle className="text-3xl">{categoryCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            上装 / 下装 / 连衣裙 / 外套 / 配饰 / 鞋履
          </CardContent>
        </Card>
      </section>

      <section className="pb-20">
        <div className="rounded-2xl border bg-muted/30 p-6 sm:p-8">
          <p className="text-sm font-medium">M0 已就绪</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            PostgreSQL + Prisma 商品模型、{categoryCount} 个分类、
            {productCount} 件种子商品（{onSaleCount} 件在售）、{imageCount}
            张占位图。演示账号见 README。
          </p>
        </div>
      </section>
    </>
  );
}

function HomeStatsSkeleton() {
  return (
    <section className="grid gap-4 pb-16 sm:grid-cols-3" aria-hidden>
      {[0, 1, 2].map((item) => (
        <Card key={item}>
          <CardHeader>
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-8 w-16 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export default function Home() {
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="py-16 sm:py-24">
        <p className="text-xs tracking-[0.32em] text-muted-foreground">
          OUTFIT EXPERT
        </p>
        <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.15] tracking-tight sm:text-6xl">
          把喜欢的衣服，
          <br />
          先穿在身上看看。
        </h1>
        <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
          孤品服装店 Demo：浏览商品、演示下单、AI
          试穿与导购助手。当前完成 M0 项目骨架，商品页与交易流程将在后续里程碑接入。
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/products" className={buttonVariants({ size: "lg" })}>
            浏览商品
          </Link>
          <Link
            href="/assistant"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            问问导购
          </Link>
        </div>
      </section>

      <Suspense fallback={<HomeStatsSkeleton />}>
        <HomeStats />
      </Suspense>
    </div>
  );
}
