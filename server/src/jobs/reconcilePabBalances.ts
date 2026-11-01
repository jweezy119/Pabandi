import { Connection, PublicKey } from '@solana/web3.js';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const PAB_MINT = new PublicKey(process.env.PAB_TOKEN_MINT || '11111111111111111111111111111111');
const connection = new Connection(process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com');

export async function reconcilePabBalances() {
  try {
    logger.info('[Reconcile] Starting PAB balance reconciliation...');

    const wallets = await prisma.agentWallet.findMany({
      where: { pdaAddress: { not: null } },
    });

    for (const wallet of wallets) {
      try {
        const pdaPubkey = new PublicKey(wallet.pdaAddress!);
        const tokenAccount = await getAssociatedTokenAddress(PAB_MINT, pdaPubkey);
        
        let onchainBalance = 0;
        try {
          const accountInfo = await getAccount(connection, tokenAccount);
          onchainBalance = Number(accountInfo.amount) / 1e9;
        } catch (e) {
          onchainBalance = 0;
        }

        const ledgerSum = await prisma.agentEarningsLedger.aggregate({
          where: { walletId: wallet.id, mint: PAB_MINT.toBase58() },
          _sum: { amount: true },
        });

        const ledgerBalance = ledgerSum._sum.amount || 0;
        const difference = Math.abs(onchainBalance - ledgerBalance);

        if (difference > 0.001) {
          await prisma.reconciliationAlert.create({
            data: {
              walletId: wallet.id,
              onchainBalance,
              ledgerBalance,
              difference,
              status: 'open',
            },
          });
          logger.warn(`[Reconcile] Mismatch for wallet ${wallet.id}: onchain=${onchainBalance}, ledger=${ledgerBalance}`);
        }
      } catch (error) {
        logger.error(`[Reconcile] Error for wallet ${wallet.id}:`, error);
      }
    }

    logger.info('[Reconcile] Completed');
  } catch (error) {
    logger.error('[Reconcile] Error:', error);
    throw error;
  }
}

if (require.main === module) {
  reconcilePabBalances()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
