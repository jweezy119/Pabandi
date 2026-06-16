import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(users.map(u => `${u.email} - ${u.role} - ${u.createdAt}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
