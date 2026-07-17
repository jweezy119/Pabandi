import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.user.update({ where: { email: 's.hussain119@gmail.com' }, data: { role: 'ADMIN' } });
  await prisma.user.update({ where: { email: 'shussain119@gmail.com' }, data: { role: 'BUSINESS_OWNER' } });

  const users = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log('✅ Updated roles:');
  users.forEach(u => console.log(' ', u.role.padEnd(16), u.email));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
