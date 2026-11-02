import Link from "next/link";
import { CartBadge } from "@/components/cart/cart-badge";
import { UserNav } from "@/components/auth/user-nav";
import { cn } from "@/lib/utils";
import { DemoBadge } from "./demo-badge";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/products", label: "商品" },
  { href: "/assistant", label: "导购" },
  { href: "/cart", label: "购物车" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="text-sm font-semibold tracking-[0.18em] sm:text-base">
            OUTFIT EXPERT
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
                item.href === "/assistant" && "hidden sm:inline-flex",
              )}
            >
              {item.label}
              {item.href === "/cart" ? <CartBadge /> : null}
            </Link>
          ))}
          <UserNav />
        </nav>
      </div>
    </header>
  );
}
