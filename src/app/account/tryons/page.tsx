import Link from "next/link";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls } from "@/lib/cos";
import { listTryonRecords, countTodayTryons } from "@/lib/tryon/run";
import { DAILY_LIMIT } from "@/lib/tryon/types";
import { TryonHistory } from "@/components/tryon/tryon-history";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "试穿历史 · OutfitHub" };
export const instant = false;

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function TryonsPage() {
  const session = await requireUser("/account/tryons");

  const [records, used] = await Promise.all([
    listTryonRecords(session.user.id),
    countTodayTryons(session.user.id),
  ]);

  const signed = await getSignedUrls(
    records
      .map((record) => record.resultKey)
      .filter((key): key is string => Boolean(key)),
  );

  const cards = records.map((record) => ({
    id: record.id,
    status: record.status,
    resultUrl: record.resultKey ? (signed[record.resultKey] ?? null) : null,
    errorMessage: record.errorMessage,
    createdAtLabel: formatDateTime(record.createdAt),
    itemNames: record.items.map((item) => item.name),
    itemCount: record.items.length,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/account"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← 个人中心
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            试穿历史
          </h1>
          <p className="text-sm text-muted-foreground">
            今日已用 {used} / {DAILY_LIMIT} 次
          </p>
        </div>
        <Link href="/tryon" className={buttonVariants({ variant: "default" })}>
          ＋ 去试穿
        </Link>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-medium">还没有试穿记录</p>
          <p className="mt-2 text-sm text-muted-foreground">
            选 1~4 件单品，用你的人像生成第一张效果图。
          </p>
          <Link
            href="/tryon"
            className={buttonVariants({ variant: "default", className: "mt-4" })}
          >
            去试穿
          </Link>
        </div>
      ) : (
        <TryonHistory records={cards} />
      )}
    </div>
  );
}
