import Link from "next/link";
import { UserNav } from "@/components/auth/user-nav";
import { cn } from "@/lib/utils";
import { DemoBadge } from "./demo-badge";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/wardrobe", label: "衣橱" },
  { href: "/looks", label: "搭配" },
  { href: "/new", label: "新单据" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="font-bodoni text-lg font-medium tracking-[0.06em] sm:text-xl">
            OutfitHub
          </span>
          <DemoBadge className="hidden sm:inline-flex" />
        </Link>

        <nav className="flex items-center gap-3 text-xs text-muted-foreground sm:gap-6 sm:text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center transition-colors hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
          <UserNav />
        </nav>
      </div>
    </header>
  );
}
