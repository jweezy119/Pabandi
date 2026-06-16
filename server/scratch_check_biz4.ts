import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(businesses.map(b => `${b.id} - ${b.name} - ${b.createdAt}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
