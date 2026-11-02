import Link from "next/link";
import { AddressFields } from "@/components/account/address-fields";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser, safeNextPath } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  createAddress,
  deleteAddress,
  setDefaultAddress,
  updateAddress,
} from "./actions";

export const instant = false;

export const metadata = { title: "收货地址" };

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AddressesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireUser("/account/addresses");
  const raw = await searchParams;
  const next = safeNextPath(raw.next, "");
  const error = typeof raw.error === "string" ? raw.error : "";
  const success = typeof raw.success === "string" ? raw.success : "";
  const successMessages: Record<string, string> = {
    created: "地址已保存",
    updated: "地址已保存",
    deleted: "地址已删除",
    default: "已设为默认地址",
  };
  const successMessage = successMessages[success];

  const addresses = await prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.28em] text-muted-foreground">
            ACCOUNT
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            收货地址
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            结算时选择地址；演示环境不产生真实物流。
          </p>
        </div>
        <Link
          href="/account"
          className={buttonVariants({ variant: "outline" })}
        >
          返回个人中心
        </Link>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {successMessage ? (
        <p
          role="status"
          className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
        >
          {successMessage}
        </p>
      ) : null}

      <div className="mt-8 space-y-4">
        {addresses.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            还没有收货地址，先在下面新增一个。
          </div>
        ) : null}

        {addresses.map((address) => (
          <Card key={address.id}>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {address.recipient} · {address.phone}
                </CardTitle>
                {address.isDefault ? (
                  <Badge variant="secondary">默认地址</Badge>
                ) : null}
              </div>
              <CardDescription>
                {address.province} {address.city} {address.district}{" "}
                {address.detail}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {!address.isDefault ? (
                  <form action={setDefaultAddress}>
                    <input type="hidden" name="addressId" value={address.id} />
                    <input type="hidden" name="next" value={next} />
                    <button
                      type="submit"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      设为默认
                    </button>
                  </form>
                ) : null}
                <form action={deleteAddress}>
                  <input type="hidden" name="addressId" value={address.id} />
                  <input type="hidden" name="next" value={next} />
                  <button
                    type="submit"
                    className={buttonVariants({
                      variant: "ghost",
                      size: "sm",
                    })}
                  >
                    删除
                  </button>
                </form>
              </div>

              <details className="rounded-lg border bg-muted/20 p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  编辑地址
                </summary>
                <form action={updateAddress} className="mt-4 space-y-4">
                  <input type="hidden" name="addressId" value={address.id} />
                  <input type="hidden" name="next" value={next} />
                  <AddressFields
                    idPrefix={`edit-${address.id}`}
                    defaults={address}
                  />
                  <button
                    type="submit"
                    className={buttonVariants({ size: "sm" })}
                  >
                    保存修改
                  </button>
                </form>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>新增地址</CardTitle>
          <CardDescription>
            演示环境：手机号仅用于展示，不会发送短信。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createAddress} className="space-y-4">
            <input type="hidden" name="next" value={next} />
            <AddressFields idPrefix="new" />
            <button type="submit" className={buttonVariants()}>
              保存地址
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
