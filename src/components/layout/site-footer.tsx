import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t bg-muted/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>OutfitHub · 个人穿搭衣橱</p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/wardrobe" className="hover:text-foreground">
            衣橱
          </Link>
          <Link href="/looks" className="hover:text-foreground">
            搭配
          </Link>
          <Link href="/new" className="hover:text-foreground">
            新单据
          </Link>
          <Link href="/account" className="hover:text-foreground">
            个人中心
          </Link>
          <span>演示环境 · 仅用于作品集展示</span>
        </div>
      </div>
    </footer>
  );
}
