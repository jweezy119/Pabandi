import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Promote shussain119@gmail.com to ADMIN
  const updated = await prisma.user.update({
    where: { email: 'shussain119@gmail.com' },
    data: { role: 'ADMIN' },
    select: { id: true, email: true, role: true },
  });
  console.log('✅ Promoted to ADMIN:', updated);

  // Show all users and their roles
  const allUsers = await prisma.user.findMany({
    select: { email: true, role: true, firstName: true, lastName: true }
  });
  console.log('\n📋 All users:');
  allUsers.forEach(u => console.log(`  ${u.role.padEnd(15)} ${u.email}  (${u.firstName} ${u.lastName})`));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
