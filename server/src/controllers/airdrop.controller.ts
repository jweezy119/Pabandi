import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { Connection, PublicKey } from '@solana/web3.js';
import { logger } from '../utils/logger';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

// ── Airdrop criteria & points ──────────────────────────────────────────────
const CRITERIA_POINTS: Record<string, number> = {
  account_created:   1000,
  phone_verified:    1500,
  google_linked:     2000,
  twitter_linked:    2000,
  wallet_connected:  2500,
  wallet_age_6m:     2500,
  wallet_age_1y:     2500,  // stacks on top of wallet_age_6m
  first_booking:     3000,
  has_review:        2000,
  business_verified: 5000,
};

// ── Helper: get wallet age in months from Solana ───────────────────────────
async function getWalletAgeMonths(address: string): Promise<number> {
  try {
    const pubKey = new PublicKey(address);
    // Get first transaction signature for this account (oldest = last in array)
    const sigs = await connection.getSignaturesForAddress(pubKey, { limit: 1000 });
    if (!sigs || sigs.length === 0) return 0;
    // Find the earliest transaction
    const oldest = sigs[sigs.length - 1];
    if (!oldest.blockTime) return 0;
    const ageMs = Date.now() - oldest.blockTime * 1000;
    return ageMs / (1000 * 60 * 60 * 24 * 30); // convert to months
  } catch {
    return 0;
  }
}

// ── Compute eligibility for a user ─────────────────────────────────────────
async function computeEligibility(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      wallet: true,
      business: true,
      reservations: { where: { status: 'COMPLETED' }, take: 1 },
      cryptoRewards: { where: { type: 'GOOGLE_REVIEW' }, take: 1 },
    },
  });

  if (!user) return { criteria: {}, totalPab: 0 };

  const criteria: Record<string, boolean> = {
    account_created:   true,
    phone_verified:    !!user.isPhoneVerified,
    google_linked:     !!user.googleId,
    twitter_linked:    !!user.twitterId,
    wallet_connected:  !!(user.wallet?.address),
    wallet_age_6m:     false,
    wallet_age_1y:     false,
    first_booking:     user.reservations.length > 0,
    has_review:        user.cryptoRewards.length > 0,
    business_verified: !!(user.business?.isVerified),
  };

  // Check wallet age via Solana RPC
  if (user.wallet?.address) {
    const ageMonths = await getWalletAgeMonths(user.wallet.address);
    criteria.wallet_age_6m = ageMonths >= 6;
    criteria.wallet_age_1y = ageMonths >= 12;
  }

  const totalPab = Object.entries(criteria).reduce((sum, [key, met]) => {
    return sum + (met ? (CRITERIA_POINTS[key] || 0) : 0);
  }, 0);

  return { criteria, totalPab };
}

// ── GET /api/v1/airdrop/stats (public) ────────────────────────────────────
export const getAirdropStats = async (_req: AuthRequest, res: Response) => {
  try {
    const claimed = await prisma.wallet.count({
      where: { airdropClaimed: true },
    });
    return res.json({ success: true, claimed, budget: 100_000_000 });
  } catch (err) {
    logger.error('Airdrop stats error:', err);
    return res.json({ success: true, claimed: 0, budget: 100_000_000 });
  }
};

// ── GET /api/v1/airdrop/eligibility (protected) ────────────────────────────
export const getEligibility = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    const alreadyClaimed = wallet?.airdropClaimed || false;

    const { criteria, totalPab } = await computeEligibility(userId);
    return res.json({ success: true, criteria, totalPab, alreadyClaimed });
  } catch (err) {
    logger.error('Airdrop eligibility error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// ── POST /api/v1/airdrop/claim (protected) ─────────────────────────────────
export const claimAirdrop = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    // Check if already claimed
    const existingWallet = await prisma.wallet.findUnique({ where: { userId } });
    if (existingWallet?.airdropClaimed) {
      return res.status(409).json({ success: false, message: 'Airdrop already claimed' });
    }

    const { criteria, totalPab } = await computeEligibility(userId);

    if (totalPab === 0) {
      return res.status(400).json({ success: false, message: 'No airdrop amount earned yet. Complete more Trust actions first.' });
    }

    // Credit balance and mark claimed — upsert wallet if it doesn't exist
    const wallet = await prisma.wallet.upsert({
      where: { userId },
      update: {
        balance: { increment: totalPab },
        airdropClaimed: true,
        airdropAmount: totalPab,
        airdropClaimedAt: new Date(),
      },
      create: {
        userId,
        balance: totalPab,
        airdropClaimed: true,
        airdropAmount: totalPab,
        airdropClaimedAt: new Date(),
      },
    });

    logger.info(`Airdrop claimed: userId=${userId} amount=${totalPab} PAB`);

    return res.json({
      success: true,
      message: `Airdrop of ${totalPab.toLocaleString()} $PAB credited to your vault!`,
      amount: totalPab,
      criteria,
      newBalance: wallet.balance,
    });
  } catch (err) {
    logger.error('Airdrop claim error:', err);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
