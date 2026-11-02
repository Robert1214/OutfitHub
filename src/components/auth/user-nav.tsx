"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import type { MouseEvent } from "react";

export function UserNav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  if (status === "loading") {
    return (
      <span className="inline-flex items-center text-muted-foreground">…</span>
    );
  }

  if (session?.user) {
    return (
      <Link
        href="/account"
        className="inline-flex items-center transition-colors hover:text-foreground"
      >
        个人
      </Link>
    );
  }

  function handleLoginClick(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const target = window.location.pathname.startsWith("/login")
      ? "/"
      : window.location.pathname + window.location.search;
    router.push(`/login?next=${encodeURIComponent(target)}`);
  }

  return (
    <Link
      href={`/login?next=${encodeURIComponent(pathname)}`}
      onClick={handleLoginClick}
      className="inline-flex items-center transition-colors hover:text-foreground"
    >
      登录
    </Link>
  );
}
