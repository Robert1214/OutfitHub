import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/lib/auth";

/** 只允许站内相对路径，避免登录后跳转到外部地址。 */
export function safeNextPath(
  value: string | string[] | undefined,
  fallback = "/account",
): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    raw.startsWith("/login")
  ) {
    return fallback;
  }
  return raw;
}

export async function requireUser(nextPath: string) {
  await connection();
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

export async function requireAdmin(nextPath: string) {
  const session = await requireUser(nextPath);
  if (session.user.role !== "ADMIN") {
    redirect("/");
  }
  return session;
}
