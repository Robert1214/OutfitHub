"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export function UserNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <span className="inline-flex items-center text-muted-foreground">…</span>
    );
  }

  return (
    <Link
      href={session?.user ? "/account" : "/login"}
      className="inline-flex items-center transition-colors hover:text-foreground"
    >
      {session?.user ? "个人中心" : "登录"}
    </Link>
  );
}
