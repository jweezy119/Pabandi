import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.findUnique({
    where: { id: 'cmqfm4dbl0001nopfwseftw69' },
    include: { owner: true }
  });
  console.log(JSON.stringify(business, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
