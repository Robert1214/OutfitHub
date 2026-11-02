import { redirect } from "next/navigation";

export const instant = false;

export default async function AccountOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const status = typeof raw.status === "string" ? raw.status : "";
  redirect(status ? `/orders?status=${encodeURIComponent(status)}` : "/orders");
}
