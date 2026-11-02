import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Bodoni_Moda, Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bodoni",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Wardrobe · 线上店铺 Demo",
    template: "%s · Wardrobe",
  },
  description: "服装店线上店铺 Demo：商品浏览、演示下单、AI 试穿与导购助手。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh-CN"
      className={cn("font-sans", geist.variable, bodoni.variable)}
    >
      <body className="flex min-h-screen flex-col bg-background text-foreground antialiased">
        <Providers>
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
