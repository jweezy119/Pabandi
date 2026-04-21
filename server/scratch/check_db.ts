import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const businesses = await prisma.business.findMany();
  console.log('Businesses in DB:', businesses);
  const users = await prisma.user.findMany({ include: { business: true } });
  console.log('Users and their businesses:', users.map(u => ({ email: u.email, role: u.role, business: u.business?.name })));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
