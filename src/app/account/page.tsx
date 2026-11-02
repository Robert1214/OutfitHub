import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { PhotoManager } from "@/components/account/photo-manager";
import { ProfileForm } from "@/components/account/profile-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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

export const instant = false;

export const metadata = { title: "个人中心" };

export default async function AccountPage() {
  const session = await requireUser("/account");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) redirect("/login?next=/account");

  const photoUrl = user.photoKey
    ? await getSignedPhotoUrlSafe(user.photoKey)
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted-foreground">
            ACCOUNT
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            个人中心
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{user.email ?? "未绑定邮箱"}</span>
            <span>·</span>
            <span>{user.phone ?? "未绑定手机号"}</span>
            <Badge variant="outline">
              {user.role === "ADMIN" ? "管理员" : "普通用户"}
            </Badge>
          </div>
        </div>
        <LogoutButton />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本资料与身材</CardTitle>
              <CardDescription>
                身材数据全部选填，用于试穿结果里的合身判断。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProfileForm
                user={{
                  name: user.name,
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
              <CardTitle>我的内容</CardTitle>
              <CardDescription>
                订单与试穿记录会随里程碑逐步接入。
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Link
                href="/orders"
                className={buttonVariants({ variant: "outline" })}
              >
                我的订单
              </Link>
              <Link
                href="/account/tryons"
                className={buttonVariants({ variant: "outline" })}
              >
                我的试穿
              </Link>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
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

          <Card>
            <CardHeader>
              <CardTitle>隐私与协议</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                照片和身材数据仅本人可见，存于 COS
                私有桶；删除照片会同步删除对象。
              </p>
              <div className="flex gap-4">
                <Link href="/privacy" className="underline">
                  隐私政策
                </Link>
                <Link href="/terms" className="underline">
                  用户协议
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
