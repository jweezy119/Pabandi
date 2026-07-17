import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);
  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log('Users in DB:', users);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
