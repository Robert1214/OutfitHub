import { config } from "dotenv";
config({ path: ".env.local" });
config();

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  productImageFiles,
  seedCategories,
  seedProducts,
} from "./seed-data";

const BCRYPT_COST = 10;

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(connectionString),
  });

  try {
    const adminHash = await bcrypt.hash("Admin123456", BCRYPT_COST);
    const demoHash = await bcrypt.hash("Demo123456", BCRYPT_COST);

    await prisma.user.upsert({
      where: { email: "admin@outfitexpert.demo" },
      update: { passwordHash: adminHash, role: "ADMIN", name: "店主" },
      create: {
        email: "admin@outfitexpert.demo",
        passwordHash: adminHash,
        role: "ADMIN",
        name: "店主",
      },
    });

    await prisma.user.upsert({
      where: { email: "demo@outfitexpert.demo" },
      update: { passwordHash: demoHash, role: "USER", name: "演示用户" },
      create: {
        email: "demo@outfitexpert.demo",
        passwordHash: demoHash,
        role: "USER",
        name: "演示用户",
      },
    });

    const categoryIdBySlug = new Map<string, string>();
    for (const category of seedCategories) {
      const row = await prisma.category.upsert({
        where: { slug: category.slug },
        update: { name: category.name, sortOrder: category.sortOrder },
        create: category,
      });
      categoryIdBySlug.set(category.slug, row.id);
    }

    for (const product of seedProducts) {
      const categoryId = categoryIdBySlug.get(product.categorySlug);
      if (!categoryId) {
        throw new Error(`分类不存在：${product.categorySlug}`);
      }

      const data = {
        name: product.name,
        refType: product.refType,
        description: product.description,
        priceCents: product.priceCents,
        categoryId,
        color: product.color,
        sizeLabel: product.sizeLabel ?? null,
        material: product.material,
        careInstructions: product.careInstructions,
        tags: product.tags,
        styleTags: product.styleTags,
        occasionTags: product.occasionTags,
        returnPolicy: product.returnPolicy ?? "RETURNABLE",
        fitType: product.fitType ?? null,
        chestCm: product.chestCm ?? null,
        lengthCm: product.lengthCm ?? null,
        shoulderCm: product.shoulderCm ?? null,
        waistCm: product.waistCm ?? null,
        hipCm: product.hipCm ?? null,
        pantsLengthCm: product.pantsLengthCm ?? null,
        stock: product.stock,
        status: product.status,
      };

      const saved = await prisma.product.upsert({
        where: { slug: product.slug },
        update: data,
        create: { slug: product.slug, ...data },
      });

      await prisma.productImage.deleteMany({
        where: { productId: saved.id },
      });
      await prisma.productImage.createMany({
        data: productImageFiles(product.slug).map((file, index) => ({
          productId: saved.id,
          url: `/products/${file}`,
          sortOrder: index,
        })),
      });
    }

    console.log(
      `Seed 完成：管理员 admin@outfitexpert.demo，测试用户 demo@outfitexpert.demo，` +
        `分类 ${seedCategories.length} 个，商品 ${seedProducts.length} 件。`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed 失败：", error);
  process.exit(1);
});
