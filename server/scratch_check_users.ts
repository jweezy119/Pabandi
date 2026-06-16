import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(users.map(u => `${u.id} - ${u.email} - ${u.createdAt}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
