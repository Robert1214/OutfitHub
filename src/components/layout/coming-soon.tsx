import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function ComingSoon({
  milestone,
  title,
  description,
}: {
  milestone: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-20 sm:py-28">
      <p className="text-xs tracking-[0.28em] text-muted-foreground">
        {milestone}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
        {description}
      </p>
      <Link
        href="/"
        className={buttonVariants({ variant: "outline", className: "mt-8" })}
      >
        返回首页
      </Link>
    </div>
  );
}
