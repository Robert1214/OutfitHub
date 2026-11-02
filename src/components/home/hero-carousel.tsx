"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatPrice } from "@/lib/format";
import type { HeroProduct } from "@/lib/products";
import { cn } from "@/lib/utils";

export function HeroCarousel({ products }: { products: HeroProduct[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (products.length <= 1 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % products.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [products.length, paused]);

  if (products.length === 0) return null;

  function go(direction: -1 | 1) {
    setIndex(
      (current) =>
        (current + direction + products.length) % products.length,
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-[#f1ede6]"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {products.map((product, slideIndex) => (
          <Link
            key={product.id}
            href={`/products/${product.slug}`}
            className="relative block aspect-[16/10] w-full shrink-0 sm:aspect-[16/7] lg:aspect-[21/9]"
            aria-label={`查看 ${product.name}`}
          >
            {product.imageUrl ? (
              <>
                <Image
                  src={product.imageUrl}
                  alt=""
                  aria-hidden
                  fill
                  sizes="(max-width: 1280px) 100vw, 1152px"
                  className="scale-110 object-cover opacity-50 blur-2xl"
                />
                <Image
                  src={product.imageUrl}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1280px) 100vw, 1152px"
                  className="object-contain p-3 sm:p-6"
                  priority={slideIndex === 0}
                />
              </>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                {product.name}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
            <div className="absolute bottom-5 left-5 max-w-[70%] text-white sm:bottom-8 sm:left-8">
              <p className="text-[11px] uppercase tracking-[0.2em] text-white/75">
                {product.categoryName}
              </p>
              <h2 className="mt-1 text-xl font-medium sm:text-3xl">
                {product.name}
              </h2>
              <p className="mt-1 text-sm text-white/90 sm:text-base">
                {formatPrice(product.priceCents)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {products.length > 1 ? (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="上一张主推商品"
            className="absolute left-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background sm:left-5 sm:size-10"
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="下一张主推商品"
            className="absolute right-3 top-1/2 z-20 flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-background sm:right-5 sm:size-10"
          >
            <ChevronRight className="size-5" />
          </button>
          <div className="absolute bottom-4 right-4 z-20 flex gap-1.5 sm:bottom-6 sm:right-6">
            {products.map((product, dotIndex) => (
              <button
                key={product.id}
                type="button"
                onClick={() => setIndex(dotIndex)}
                aria-label={`查看第 ${dotIndex + 1} 张主推商品`}
                aria-current={dotIndex === index}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  dotIndex === index
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/50 hover:bg-white/75",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
