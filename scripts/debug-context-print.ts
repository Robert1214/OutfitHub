import { prisma } from "../src/lib/db";

async function main() {
  const product = await prisma.product.findUnique({
    where: { slug: "black-silk-shirt" },
    select: {
      id: true, name: true, slug: true, description: true, priceCents: true,
      color: true, sizeLabel: true, refType: true, material: true,
      careInstructions: true, tags: true, styleTags: true, occasionTags: true,
      returnPolicy: true, fitType: true, status: true,
      category: { select: { name: true, slug: true } },
    },
  });
  console.log(JSON.stringify(product, null, 2));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
