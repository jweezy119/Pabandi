import { prisma } from './utils/database';

async function main() {
  const events = await prisma.invoiceTrustEvent.groupBy({
    by: ['eventType'],
    _count: true,
    orderBy: { eventType: 'asc' }
  });
  console.log('--- DB EVENTS ---');
  let total = 0;
  events.forEach(e => {
    console.log(`${e.eventType}: ${e._count}`);
    total += e._count;
  });
  console.log(`TOTAL_ROWS: ${total}`);
  console.log('TYPES:', events.map(e => e.eventType).join(', '));
}

main().catch(console.error).finally(() => prisma.$disconnect());
