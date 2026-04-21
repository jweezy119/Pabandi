import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const business = await prisma.business.updateMany({
    where: { name: 'Pabandi Premium Lounge' },
    data: {
      googlePlaceId: 'ChIJr4a7oB7yGTkR7F_lq3yMvRk', // Kolachi's Place ID
      name: 'Kolachi Restaurant (Pabandi Partner)'
    }
  });
  console.log('Updated business to link with Google Place ID:', business);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
