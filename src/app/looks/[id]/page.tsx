import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guards";
import { getSignedUrls, getSignedUrlSafe } from "@/lib/cos";
import { getLook } from "@/lib/looks";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/validations/wardrobe";
import { HoverSwapImage } from "@/components/looks/hover-swap-image";
import { FallbackGrid } from "@/components/looks/fallback-grid";
import { LookActions } from "@/components/looks/look-actions";
import { CosImage } from "@/components/wardrobe/cos-image";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "搭配详情 · OutfitHub" };
export const instant = false;

type Props = { params: Promise<{ id: string }> };

export default async function LookDetailPage({ params }: Props) {
  const session = await requireUser("/looks");
  const { id } = await params;
  const look = await getLook(session.user.id, id);
  if (!look) notFound();

  const [photoUrl, collageUrl] = await Promise.all([
    look.photoKey ? getSignedUrlSafe(look.photoKey) : null,
    look.collageKey ? getSignedUrlSafe(look.collageKey) : null,
  ]);

  // 单品缩略图用白底版（列表/详情展示统一用白底）
  const thumbKeys = look.items.map((item) => item.flatKey ?? item.whiteKey);
  const thumbs = await getSignedUrls(thumbKeys);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link
        href="/looks"
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        ← 返回搭配
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {photoUrl || collageUrl ? (
            <HoverSwapImage
              front={photoUrl}
              back={collageUrl}
              alt={look.name}
              className="aspect-[4/5] rounded-xl border"
              fit="contain"
              priority
              fallbackText="暂无图片"
            />
          ) : (
            // 既没实穿照也没拼合图 → 用单品白底图拼一个示意
            <FallbackGrid
              urls={look.items.map((_, i) => thumbs[thumbKeys[i]] ?? null)}
              alt={look.name}
              className="aspect-[4/5] rounded-xl border"
            />
          )}
          <p className="text-center text-xs text-muted-foreground">
            {photoUrl && collageUrl
              ? "悬停切换实穿照 / 白底拼合图；手机点右上角按钮"
              : photoUrl
                ? "仅实穿照"
                : collageUrl
                  ? "仅白底拼合图"
                  : "还没生成拼合图，显示单品示意"}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {look.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {look.occasion ? <Badge variant="outline">{look.occasion}</Badge> : null}
              {look.wornAt ? (
                <span>{formatDateTime(look.wornAt).slice(0, 10)}</span>
              ) : null}
              <span>{look.itemCount} 件</span>
            </div>
          </div>

          {look.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {look.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/looks?tag=${encodeURIComponent(tag.name)}`}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs hover:bg-muted/70"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          ) : null}

          <LookActions look={{ id: look.id, name: look.name }} />

          {look.note ? (
            <div className="rounded-xl border p-3">
              <p className="text-xs text-muted-foreground">备注</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{look.note}</p>
            </div>
          ) : null}

          <div className="space-y-3">
            <h2 className="text-sm font-medium">单品清单</h2>
            <ul className="space-y-2">
              {look.items.map((item, index) => (
                <li key={item.id}>
                  <Link
                    href={`/items/${item.id}`}
                    className="flex items-center gap-3 rounded-lg border p-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="size-14 shrink-0 overflow-hidden rounded-md border bg-white">
                      <CosImage
                        src={thumbs[thumbKeys[index]] ?? null}
                        alt={item.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[item.category]}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
