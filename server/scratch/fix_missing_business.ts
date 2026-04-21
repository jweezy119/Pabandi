import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'shussain119@gmail.com' }
  });

  if (user && user.role === 'BUSINESS_OWNER') {
    const business = await prisma.business.create({
      data: {
        name: 'Pabandi Premium Lounge',
        ownerId: user.id,
        category: 'RESTAURANT',
        address: 'DHA Phase 6, Karachi',
        phone: user.phone || '+92 300 1234567',
        email: user.email,
        isActive: true,
        isVerified: true
      }
    });
    console.log('Manually created business:', business);
  } else {
    console.log('User not found or not a business owner.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
