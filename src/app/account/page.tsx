import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { PhotoManager } from "@/components/account/photo-manager";
import { ProfileForm } from "@/components/account/profile-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guards";
import { getSignedPhotoUrlSafe } from "@/lib/cos";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/format";

export const instant = false;

export const metadata = { title: "个人中心" };

const orderStats = [
  { label: "待付款", status: "PENDING_PAYMENT" },
  { label: "待发货", status: "PAID_DEMO" },
  { label: "待收货", status: "SHIPPED_DEMO" },
  { label: "已完成", status: "COMPLETED" },
  { label: "退款/售后", status: "REFUNDED" },
] as const;

type RecentProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  images: { url: string }[];
};

function RecentProductsCard({
  title,
  count,
  items,
  emptyText,
}: {
  title: string;
  count: number;
  items: RecentProduct[];
  emptyText: string;
}) {
  const latest = items[0];

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>{title}</CardTitle>
          <span className="text-xs text-muted-foreground">{count} 件</span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 items-center">
        {latest ? (
          <div className="flex w-full gap-3">
            <Link
              href={`/products/${latest.slug}`}
              className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border bg-muted"
            >
              {latest.images[0]?.url ? (
                <Image
                  src={latest.images[0].url}
                  alt={latest.name}
                  fill
                  sizes="80px"
                  className="object-contain"
                />
              ) : null}
            </Link>
            <div className="min-w-0 flex-1">
              <Link
                href={`/products/${latest.slug}`}
                className="line-clamp-2 text-sm font-medium hover:underline"
              >
                {latest.name}
              </Link>
              <p className="mt-2 text-sm">{formatPrice(latest.priceCents)}</p>
              {items.length > 1 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  还有 {count - 1} 件
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AccountPage() {
  const session = await requireUser("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login?next=/account");

  const [
    orderCounts,
    favoriteCount,
    footprintCount,
    favorites,
    footprints,
    photoUrl,
    avatarUrl,
  ] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.footprint.count({ where: { userId: user.id } }),
    prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            priceCents: true,
            images: {
              orderBy: { sortOrder: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    }),
    prisma.footprint.findMany({
      where: { userId: user.id },
      orderBy: { viewedAt: "desc" },
      take: 3,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            priceCents: true,
            images: {
              orderBy: { sortOrder: "asc" },
              take: 1,
              select: { url: true },
            },
          },
        },
      },
    }),
    user.photoKey ? getSignedPhotoUrlSafe(user.photoKey) : null,
    user.imageKey ? getSignedPhotoUrlSafe(user.imageKey) : null,
  ]);

  const countByStatus = new Map(
    orderCounts.map((row) => [row.status, row._count._all]),
  );
  const displayName =
    user.name?.trim() ||
    user.email?.split("@")[0] ||
    user.phone ||
    "Wardrobe 顾客";
  const avatarSrc = avatarUrl ?? photoUrl;
  const favoriteProducts = favorites.map((item) => item.product);
  const footprintProducts = footprints.map((item) => item.product);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <section className="rounded-2xl border bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
            {avatarSrc ? (
              // 签名 COS URL 域名随桶变化，使用原生 img 避免配置 remotePatterns。
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt={`${displayName} 的头像`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="font-bodoni text-4xl font-medium text-muted-foreground">
                {displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {displayName}
              </h1>
              <Badge variant="outline">
                {user.role === "ADMIN" ? "管理员" : "普通用户"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {user.email ?? user.phone ?? "未绑定账号"}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <Link
                href="/account/addresses"
                className="underline-offset-4 hover:underline"
              >
                收货地址
              </Link>
              <Link
                href="/account/tryons"
                className="underline-offset-4 hover:underline"
              >
                我的试穿
              </Link>
              <Link
                href="/privacy"
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                隐私与协议
              </Link>
            </div>
          </div>

          <LogoutButton />
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
        <Card className="flex h-full flex-col">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>我的订单</CardTitle>
              <Link
                href="/orders"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              >
                查看全部订单 →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-1 items-center">
            <div className="grid w-full grid-cols-5 gap-1 text-center">
              {orderStats.map((item) => (
                <Link
                  key={item.status}
                  href={`/orders?status=${item.status}`}
                  className="rounded-lg px-1 py-3 transition-colors hover:bg-muted/60"
                >
                  <span className="block text-2xl font-semibold">
                    {countByStatus.get(item.status) ?? 0}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <RecentProductsCard
            title="我的收藏"
            count={favoriteCount}
            items={favoriteProducts}
            emptyText="还没有收藏，去商品页点小星星吧。"
          />
          <RecentProductsCard
            title="我的足迹"
            count={footprintCount}
            items={footprintProducts}
            emptyText="还没有足迹，去逛逛商品吧。"
          />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle>身材信息</CardTitle>
            <CardDescription>
              用于试穿合身判断，只有你本人可见；可随时清空。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm
              user={{
                heightCm: user.heightCm,
                weightKg: user.weightKg,
                bustCm: user.bustCm,
                waistCm: user.waistCm,
                hipCm: user.hipCm,
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>本人照片</CardTitle>
            <CardDescription>
              AI 试穿前必须上传；照片只用于试穿，不用于训练。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PhotoManager initialUrl={photoUrl} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
