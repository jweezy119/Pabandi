import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean up orphaned AgentFeedback records using raw SQL to bypass Prisma's
  // strict relation filter types. These records have bookingId values that point
  // to non-existent bookings and would block FK constraints.
  const result = await prisma.$executeRaw`
    DELETE FROM "AgentFeedback"
    WHERE "bookingId" IS NOT NULL
    AND "bookingId" NOT IN (SELECT id FROM "Booking")
  `;
  if (result > 0) {
    console.log(`Cleaned up ${result} orphaned AgentFeedback records.`);
  }
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
