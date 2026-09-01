import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Clean up orphaned AgentFeedback records before schema push.
  // These have bookingId values that point to non-existent bookings and
  // would block the foreign key constraint from being created.
  const orphaned = await prisma.agentFeedback.count({
    where: {
      bookingId: { not: null },
      booking: null,
    },
  });
  if (orphaned > 0) {
    console.log(`Cleaning up ${orphaned} orphaned AgentFeedback records...`);
    await prisma.agentFeedback.deleteMany({
      where: {
        bookingId: { not: null },
        booking: null,
      },
    });
    console.log('Orphaned AgentFeedback records cleaned up.');
  }

  // Clean up any other orphaned records that could block FK constraints
  // Add similar cleanup here for future models if needed.
}

main()
  .catch((e) => {
    console.error('Cleanup failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
