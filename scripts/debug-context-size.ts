import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL!) });

async function main() {
  const select = {
    id: true,
    name: true,
    slug: true,
    description: true,
    priceCents: true,
    color: true,
    sizeLabel: true,
    refType: true,
    material: true,
    careInstructions: true,
    tags: true,
    styleTags: true,
    occasionTags: true,
    returnPolicy: true,
    fitType: true,
    chestCm: true,
    lengthCm: true,
    waistCm: true,
    hipCm: true,
    pantsLengthCm: true,
    status: true,
    category: { select: { name: true, slug: true } },
  };
  const product = await prisma.product.findUnique({
    where: { slug: "black-silk-shirt" },
    select,
  });
  if (!product) {
    console.log("black-silk-shirt 不存在");
    process.exit(1);
  }
  const json = JSON.stringify(product);
  console.log("product_context JSON 总长度:", json.length, "字符");
  const rows: Array<[string, number]> = [];
  const base = JSON.parse(json) as Record<string, unknown>;
  for (const [k, v] of Object.entries(base)) {
    if (k === "category") continue;
    rows.push([k, (JSON.stringify(v) ?? "null").length]);
  }
  const catLen = JSON.stringify(base.category).length;
  rows.push(["category", catLen]);
  rows.sort((a, b) => b[1] - a[1]);
  for (const [k, len] of rows) console.log(`${k}: ${len}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

// 打印实际 JSON 内容
import { prisma as p2 } from "../src/lib/db";
