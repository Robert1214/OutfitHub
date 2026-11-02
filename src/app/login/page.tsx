import { Suspense } from "react";
import { LoginForms } from "@/components/auth/login-forms";
import { safeNextPath } from "@/lib/auth-guards";

export const metadata = { title: "登录" };

type SearchParams = Record<string, string | string[] | undefined>;

async function LoginContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const nextPath = safeNextPath(raw.next);

  return <LoginForms nextPath={nextPath} />;
}

function LoginSkeleton() {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8" aria-hidden>
      <div className="h-10 animate-pulse rounded-lg bg-muted" />
      <div className="mt-6 space-y-4">
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-lg bg-muted" />
        <div className="h-9 animate-pulse rounded-lg bg-muted" />
      </div>
    </div>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="mb-6 text-center">
        <p className="text-xs tracking-[0.28em] text-muted-foreground">
          ACCOUNT
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          登录 / 注册
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          登录后可保存身材、照片、购物车与订单。
        </p>
      </div>

      <Suspense fallback={<LoginSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
