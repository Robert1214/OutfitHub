import { prisma } from "../src/lib/db";

async function main() {
  const rows = await prisma.assistantLog.findMany({
    where: { error: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { createdAt: true, conversationId: true, query: true, error: true },
  });
  for (const r of rows) console.log(r.createdAt.toISOString(), "|", r.query, "|", r.error);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
