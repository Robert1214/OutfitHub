import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { PhotoManager } from "@/components/account/photo-manager";
import { ProfileForm } from "@/components/account/profile-form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guards";
import { getSignedPhotoUrlSafe } from "@/lib/cos";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export const instant = false;

export const metadata = { title: "个人中心" };

export default async function AccountPage() {
  const session = await requireUser("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login?next=/account");

  const [
    wardrobeCount,
    newCount,
    lookCount,
    tryonCount,
    todayTryonCount,
    dayStart,
    photoUrl,
  ] = await Promise.all([
    prisma.wardrobeItem.count({
      where: { userId: user.id, zone: "WARDROBE" },
    }),
    prisma.wardrobeItem.count({ where: { userId: user.id, zone: "NEW" } }),
    prisma.outfit.count({ where: { userId: user.id } }),
    prisma.tryonRecord.count({ where: { userId: user.id } }),
    prisma.tryonRecord.count({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),
    new Date(new Date().setHours(0, 0, 0, 0)),
    user.photoKey ? getSignedPhotoUrlSafe(user.photoKey) : null,
  ]);

  void todayTryonCount;
  void dayStart;

  const stats = [
    { label: "衣橱", value: wardrobeCount, href: "/wardrobe" },
    { label: "搭配", value: lookCount, href: "/looks" },
    { label: "待定", value: newCount, href: "/new" },
    { label: "试穿", value: tryonCount, href: "/account/tryons" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          ACCOUNT
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          个人中心
        </h1>
      </div>

      <section className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>账号</CardTitle>
              <Badge variant="outline">
                {user.role === "ADMIN" ? "管理员" : "演示账号"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">邮箱</p>
                <p>{user.email ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">手机号</p>
                <p>{user.phone ? maskPhone(user.phone) : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">昵称</p>
                <p>{user.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">注册时间</p>
                <p>{formatDateTime(user.createdAt).slice(0, 10)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t pt-3">
              <Link
                href="/account/tryons"
                className="text-sm underline-offset-4 hover:underline"
              >
                试穿历史
              </Link>
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                隐私与协议
              </Link>
              <LogoutButton />
            </div>
          </CardContent>
        </Card>

        {/* 我的衣橱概览 */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="rounded-xl border p-4 transition-colors hover:bg-muted/50"
            >
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="mt-6 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>身材信息</CardTitle>
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
          </CardHeader>
          <CardContent>
            <PhotoManager initialUrl={photoUrl} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function maskPhone(phone: string): string {
  return phone.length === 11
    ? `${phone.slice(0, 3)}****${phone.slice(-4)}`
    : phone;
}
