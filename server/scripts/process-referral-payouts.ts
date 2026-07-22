import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Nightly Referral Payout Processing...');

  const batchId = uuidv4();
  
  // We process payouts for the previous calendar month.
  // Or we can just process all pending ledgers up to the end of the previous month.
  // The spec says: select all ReferralLedger where payoutId == null and isReversed == false
  
  const pendingLedgers = await prisma.referralLedger.findMany({
    where: {
      payoutId: null,
      isReversed: false
    }
  });

  if (pendingLedgers.length === 0) {
    console.log('No pending ledgers to process.');
    return;
  }

  // Group by profileId
  const ledgersByProfile: Record<string, typeof pendingLedgers> = {};
  for (const ledger of pendingLedgers) {
    if (!ledgersByProfile[ledger.profileId]) {
      ledgersByProfile[ledger.profileId] = [];
    }
    ledgersByProfile[ledger.profileId].push(ledger);
  }

  for (const [profileId, ledgers] of Object.entries(ledgersByProfile)) {
    const totalAmount = ledgers.reduce((sum, l) => sum + l.amount, 0);

    if (totalAmount <= 0) continue;

    console.log(`Processing payout for profile ${profileId} - Amount: ${totalAmount}`);

    // Create payout record
    await prisma.$transaction(async (tx) => {
      const payout = await tx.referralPayout.create({
        data: {
          profileId,
          amount: totalAmount,
          status: 'PENDING', // Nightly job creates it as PENDING, a manual or payment gateway hook sets to PAID
          settlementBatchId: batchId,
          periodStart: startOfMonth(new Date()), // Placeholder, since it groups all pending
          periodEnd: endOfMonth(new Date())
        }
      });

      // Update ledgers to link to this payout
      await tx.referralLedger.updateMany({
        where: {
          id: { in: ledgers.map(l => l.id) }
        },
        data: {
          payoutId: payout.id
        }
      });
    });
  }

  console.log(`Successfully completed batch ${batchId}`);
}

main()
  .catch(e => {
    console.error('Error processing referral payouts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
