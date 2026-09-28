import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const res = await prisma.invoiceTrustEvent.groupBy({
    by: ['eventType'],
    _count: true
  });
  console.log(res);
}
main().catch(console.error).finally(() => prisma.$disconnect());
