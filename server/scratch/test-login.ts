import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    console.log(`Email: '${u.email}', Role: '${u.role}', Len: ${u.email.length}`);
    const codes = Array.from(u.email).map(c => c.charCodeAt(0));
    console.log(`Codes:`, codes);
  }
}

main().finally(() => prisma.$disconnect());
