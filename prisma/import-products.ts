import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { PrismaPg } from "@prisma/adapter-pg";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { PrismaClient } from "../src/generated/prisma/client";

const CATEGORY_SLUGS: Record<string, string> = {
  上装: "tops",
  下装: "bottoms",
  连衣裙: "dresses",
  外套: "outerwear",
  配饰: "accessories",
  鞋履: "shoes",
};

const emptyToUndefined = (value: unknown) =>
  value === "" || value === null || value === undefined ? undefined : value;

const optionalString = z.preprocess(
  emptyToUndefined,
  z.string().trim().min(1).optional(),
);

const optionalInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().optional(),
);

const imageName = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/,
    "图片必须是 public/products/ 下的 jpg/png/webp 文件名",
  );

const rowSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "slug 只能是小写英文/数字/-"),
    name: z.string().trim().min(1),
    ref_type: z.enum(["GARMENT", "ACCESSORIES", "SHOES"]),
    description: z.string().trim().min(1),
    price_yuan: z.coerce.number().positive(),
    category: z.string().trim().min(1),
    color: z.string().trim().min(1),
    size_label: optionalString,
    material: z.string().trim().min(1),
    care: z.string().trim().min(1),
    tags: optionalString,
    fit_type: z.preprocess(
      emptyToUndefined,
      z.enum(["SLIM", "REGULAR", "LOOSE"]).optional(),
    ),
    chest_cm: optionalInt,
    length_cm: optionalInt,
    shoulder_cm: optionalInt,
    waist_cm: optionalInt,
    hip_cm: optionalInt,
    pants_length_cm: optionalInt,
    image1: imageName,
    image2: imageName,
    image3: imageName,
  })
  .superRefine((row, ctx) => {
    if (row.ref_type !== "GARMENT") return;

    if (!row.fit_type) {
      ctx.addIssue({
        code: "custom",
        path: ["fit_type"],
        message: "GARMENT 必须填 fit_type",
      });
    }

    const isBottom = row.category === "下装" || row.category === "bottoms";
    if (isBottom) {
      if (!row.waist_cm) {
        ctx.addIssue({
          code: "custom",
          path: ["waist_cm"],
          message: "下装必须填 waist_cm",
        });
      }
      if (!row.hip_cm) {
        ctx.addIssue({
          code: "custom",
          path: ["hip_cm"],
          message: "下装必须填 hip_cm",
        });
      }
      if (!row.pants_length_cm) {
        ctx.addIssue({
          code: "custom",
          path: ["pants_length_cm"],
          message: "下装必须填 pants_length_cm",
        });
      }
      return;
    }

    if (!row.chest_cm) {
      ctx.addIssue({
        code: "custom",
        path: ["chest_cm"],
        message: "上装/连衣裙/外套必须填 chest_cm",
      });
    }
    if (!row.length_cm) {
      ctx.addIssue({
        code: "custom",
        path: ["length_cm"],
        message: "上装/连衣裙/外套必须填 length_cm",
      });
    }
  });

function categorySlug(name: string): string {
  const known = CATEGORY_SLUGS[name];
  if (known) return known;
  const ascii = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (ascii) return ascii;
  return `cat-${createHash("sha256").update(name).digest("hex").slice(0, 10)}`;
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "行"}: ${issue.message}`)
    .join("；");
}

async function main() {
  const csvPath = process.argv[2] ?? path.join("data", "products-template.csv");
  if (!existsSync(csvPath)) {
    throw new Error(`CSV 文件不存在：${csvPath}`);
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg(connectionString),
  });

  const errors: string[] = [];
  let successCount = 0;

  try {
    const rows = parse(readFileSync(csvPath, "utf8"), {
      bom: true,
      columns: true,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    if (rows.length === 0) {
      throw new Error("CSV 没有数据行");
    }

    for (let index = 0; index < rows.length; index += 1) {
      const lineNo = index + 2;
      const parsed = rowSchema.safeParse(rows[index]);
      if (!parsed.success) {
        errors.push(`第 ${lineNo} 行：${formatIssues(parsed.error)}`);
        continue;
      }

      const row = parsed.data;
      const images = [row.image1, row.image2, row.image3];
      const missing = images.filter(
        (file) => !existsSync(path.join("public", "products", file)),
      );
      if (missing.length > 0) {
        errors.push(`第 ${lineNo} 行：图片不存在 ${missing.join("、")}`);
        continue;
      }

      try {
        const category = await prisma.category.upsert({
          where: { name: row.category },
          update: {},
          create: {
            name: row.category,
            slug: categorySlug(row.category),
          },
        });

        const data = {
          name: row.name,
          refType: row.ref_type,
          description: row.description,
          priceCents: Math.round(row.price_yuan * 100),
          categoryId: category.id,
          color: row.color,
          sizeLabel: row.size_label ?? null,
          material: row.material,
          careInstructions: row.care,
          tags: row.tags
            ? row.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [],
          fitType: row.fit_type ?? null,
          chestCm: row.chest_cm ?? null,
          lengthCm: row.length_cm ?? null,
          shoulderCm: row.shoulder_cm ?? null,
          waistCm: row.waist_cm ?? null,
          hipCm: row.hip_cm ?? null,
          pantsLengthCm: row.pants_length_cm ?? null,
          stock: 1,
          status: "ON_SALE" as const,
        };

        await prisma.$transaction(async (tx) => {
          const saved = await tx.product.upsert({
            where: { slug: row.slug },
            update: data,
            create: { slug: row.slug, ...data },
          });

          await tx.productImage.deleteMany({
            where: { productId: saved.id },
          });
          await tx.productImage.createMany({
            data: images.map((file, imageIndex) => ({
              productId: saved.id,
              url: `/products/${file}`,
              sortOrder: imageIndex,
            })),
          });
        });

        successCount += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`第 ${lineNo} 行：数据库写入失败（${message}）`);
      }
    }

    console.log(
      `导入完成：成功 ${successCount} 行，失败 ${errors.length} 行。`,
    );
    if (errors.length > 0) {
      for (const error of errors) {
        console.error(` - ${error}`);
      }
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("导入失败：", error);
  process.exit(1);
});
