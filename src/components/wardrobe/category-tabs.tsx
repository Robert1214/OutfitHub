import Link from "next/link";
import { buildWardrobeHref, type WardrobeQueryState } from "@/lib/wardrobe/query";
import { CATEGORY_LABELS, type ItemCategoryValue } from "@/lib/validations/wardrobe";
import { cn } from "@/lib/utils";

type Props = {
  current: WardrobeQueryState;
  counts: Record<ItemCategoryValue | "ALL", number>;
};

const ORDER: (ItemCategoryValue | "ALL")[] = [
  "ALL",
  "TOP",
  "BOTTOM",
  "SHOES",
  "ACCESSORY",
];

/** 四分类 Tab：全部 / 上装 / 下装 / 鞋子 / 配饰，带数量 */
export function CategoryTabs({ current, counts }: Props) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b pb-px">
      {ORDER.map((value) => {
        const active = value === "ALL" ? !current.category : current.category === value;
        const href = buildWardrobeHref(current, {
          category: value === "ALL" ? undefined : value,
        });
        return (
          <Link
            key={value}
            href={href}
            className={cn(
              "relative shrink-0 px-3 pb-2.5 pt-1 text-sm transition-colors",
              active
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {value === "ALL" ? "全部" : CATEGORY_LABELS[value]}
            <span className="ml-1 text-xs text-muted-foreground">
              {counts[value]}
            </span>
            {active ? (
              <span className="absolute inset-x-2 -bottom-px h-0.5 bg-foreground" />
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
