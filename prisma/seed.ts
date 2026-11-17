/**
 * 种子数据：只创建演示账号（不建商品数据，衣橱由用户自己录入）。
 *
 *   admin@outfitexpert.demo / Admin123456  （ADMIN）
 *   demo@outfitexpert.demo  / Demo123456   （USER）
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

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
    const adminPassword = await bcrypt.hash("Admin123456", BCRYPT_COST);
    const demoPassword = await bcrypt.hash("Demo123456", BCRYPT_COST);

    await prisma.user.upsert({
      where: { email: "admin@outfitexpert.demo" },
      update: { passwordHash: adminPassword, role: "ADMIN" },
      create: {
        email: "admin@outfitexpert.demo",
        name: "店主",
        passwordHash: adminPassword,
        role: "ADMIN",
      },
    });

    await prisma.user.upsert({
      where: { email: "demo@outfitexpert.demo" },
      update: { passwordHash: demoPassword },
      create: {
        email: "demo@outfitexpert.demo",
        name: "演示用户",
        passwordHash: demoPassword,
        role: "USER",
      },
    });

    console.log(
      "Seed 完成：admin@outfitexpert.demo / Admin123456，" +
        "demo@outfitexpert.demo / Demo123456",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed 失败：", error);
  process.exit(1);
});
