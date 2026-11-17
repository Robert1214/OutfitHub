import Link from "next/link";
import { FallbackGrid } from "@/components/looks/fallback-grid";
import { HoverSwapImage } from "@/components/looks/hover-swap-image";
import { cn } from "@/lib/utils";

export type LookCardData = {
  id: string;
  name: string;
  occasion: string | null;
  wornAtLabel: string | null;
  photoUrl: string | null;
  collageUrl: string | null;
  /** 兜底预览用的单品图（没有实穿照/拼合图时使用） */
  fallbackUrls: (string | null)[];
  itemCount: number;
  tags: { id: string; name: string }[];
};

type Props = {
  looks: LookCardData[];
  /** 列数配置（首页搭配流用 3 列，列表页用 4 列） */
  columns?: "grid" | "wide";
};

/**
 * 搭配卡片网格。
 * 默认显示实穿照，悬停切换白底拼合图（HoverSwapImage）。
 */
export function LookGrid({ looks, columns = "grid" }: Props) {
  return (
    <ul
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3",
        columns === "grid" ? "lg:grid-cols-4" : "lg:grid-cols-4",
      )}
    >
      {looks.map((look, index) => (
        <li key={look.id}>
          <Link href={`/looks/${look.id}`} className="group block">
            {look.photoUrl || look.collageUrl ? (
              <HoverSwapImage
                front={look.photoUrl}
                back={look.collageUrl}
                alt={look.name}
                className="aspect-[4/5] rounded-xl border"
                fit="contain"
                priority={index < 4}
                fallbackText="暂无图片"
              />
            ) : (
              // 既没实穿照也没拼合图 → 用单品白底图拼一个示意
              <FallbackGrid
                urls={look.fallbackUrls}
                alt={look.name}
                className="aspect-[4/5] rounded-xl border"
              />
            )}

            <div className="mt-2.5 space-y-1">
              <h3 className="line-clamp-1 text-sm font-medium">{look.name}</h3>
              <p className="text-xs text-muted-foreground">
                {[
                  look.occasion,
                  look.wornAtLabel,
                  `${look.itemCount} 件`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {look.tags.length > 0 ? (
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {look.tags
                    .slice(0, 3)
                    .map((tag) => `#${tag.name}`)
                    .join(" ")}
                </p>
              ) : null}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
