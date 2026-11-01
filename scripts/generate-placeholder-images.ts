import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { productImageFiles, seedProducts } from "../prisma/seed-data";

const OUTPUT_DIR = path.join(process.cwd(), "public", "products");

function hashHue(input: string): number {
  let hash = 0;
  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }
  return hash;
}

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function placeholderSvg(
  name: string,
  hue: number,
  index: number,
): string {
  const background = `hsl(${hue} ${28 + index * 4}% ${88 - index * 6}%)`;
  const accent = `hsl(${hue} 30% ${Math.max(28, 58 - index * 6)}%)`;
  const safeName = escapeXml(name);
  return `
    <svg width="800" height="1000" viewBox="0 0 800 1000" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="1000" fill="${background}" />
      <rect x="80" y="80" width="640" height="840" rx="24" fill="none" stroke="${accent}" stroke-width="2" opacity="0.55" />
      <circle cx="400" cy="420" r="150" fill="${accent}" opacity="0.16" />
      <circle cx="400" cy="420" r="92" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5" />
      <text x="400" y="640" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, Arial, sans-serif" font-size="42" fill="${accent}">${safeName}</text>
      <text x="400" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" letter-spacing="5" fill="${accent}">OUTFIT EXPERT</text>
      <text x="400" y="760" text-anchor="middle" font-family="Microsoft YaHei, PingFang SC, Arial, sans-serif" font-size="20" fill="${accent}" opacity="0.8">演示占位图 ${index + 1} / 3</text>
    </svg>
  `;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const product of seedProducts) {
    const hue = hashHue(product.slug);
    const files = productImageFiles(product.slug);
    for (let index = 0; index < files.length; index += 1) {
      const svg = placeholderSvg(product.name, hue, index);
      await sharp(Buffer.from(svg))
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(path.join(OUTPUT_DIR, files[index]));
    }
    console.log(`生成占位图：${product.slug}（${files.length} 张）`);
  }

  console.log(`完成：${seedProducts.length * 3} 张，目录 public/products/`);
}

main().catch((error) => {
  console.error("生成占位图失败：", error);
  process.exit(1);
});
