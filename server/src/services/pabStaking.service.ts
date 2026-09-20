import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const LOCK_PERIOD_DAYS = 7;

const STAKE_TIERS = {
  BRONZE: { minAmount: 0, trustBoost: 0, apy: 0 },
  SILVER: { minAmount: 100, trustBoost: 100, apy: 5 },
  GOLD: { minAmount: 500, trustBoost: 300, apy: 8 },
  PLATINUM: { minAmount: 2000, trustBoost: 1000, apy: 12 },
};

type StakeTier = keyof typeof STAKE_TIERS;

function getConnection(): Connection {
  const url = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  return new Connection(url, 'confirmed');
}

function getPlatformKeypair(): Keypair | null {
  const privateKey = process.env.PLATFORM_PRIVATE_KEY;
  if (!privateKey) {
    logger.error('PLATFORM_PRIVATE_KEY not set');
    return null;
  }
  try {
    const secretKey = bs58.decode(privateKey);
    return Keypair.fromSecretKey(secretKey);
  } catch (err: any) {
    logger.error('Invalid PLATFORM_PRIVATE_KEY:', err.message);
    return null;
  }
}

function getPabMint(): string {
  return process.env.PAB_MINT_ADDRESS || 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
}

export async function stakePab(userId: string, tier: StakeTier): Promise<any> {
  const tierConfig = STAKE_TIERS[tier];
  if (!tierConfig) {
    return { success: false, error: 'Invalid tier. Choose BRONZE, SILVER, GOLD, or PLATINUM.' };
  }

  const amount = tierConfig.minAmount;
  const connection = getConnection();
  const platformKey = getPlatformKeypair();
  if (!platformKey) return { success: false, error: 'Platform wallet not configured' };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'User not found' };

  // Check if user already has an active stake at this tier
  const existingStake = await prisma.stakingRecord.findFirst({
    where: { userId, tier, status: 'ACTIVE' },
  });
  if (existingStake) {
    return { success: false, error: `Already staked at ${tier} tier` };
  }

  // Get user wallet
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.balance < amount) {
    return { success: false, error: `Insufficient PAB balance. Need ${amount} PAB, have ${wallet?.balance || 0}` };
  }

  const mintKey = new PublicKey(getPabMint());
  const fromKey = new PublicKey(wallet.address || '');
  const toKey = platformKey.publicKey;

  const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
  const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

  const { Transaction } = await import('@solana/web3.js');
  const transaction = new Transaction();

  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toAccountInfo) {
    const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
    transaction.add(
      createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey)
    );
  }

  const amountRaw = Math.round(amount * Math.pow(10, 9));
  transaction.add(
    createTransferInstruction(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], TOKEN_PROGRAM_ID)
  );

  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKey;

  // Note: In production, the user signs client-side and sends signed tx
  // For now, we record the intent and update balances
  const unlockAt = new Date(Date.now() + LOCK_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const stakingRecord = await prisma.stakingRecord.create({
    data: {
      userId,
      tier,
      amountPab: amount,
      trustBoost: tierConfig.trustBoost,
      status: 'ACTIVE',
      unlockAt,
    },
  });

  // Update user's staked amount and trust score
  await prisma.user.update({
    where: { id: userId },
    data: {
      pabStaked: { increment: amount },
      trustScore: { increment: tierConfig.trustBoost },
    },
  });

  // Deduct from wallet
  await prisma.wallet.update({
    where: { userId },
    data: { balance: { decrement: amount } },
  });

  logger.info(`[PabStaking] User ${userId} staked ${amount} PAB at ${tier} tier`);

  return {
    success: true,
    stakingRecord,
    tier,
    amount,
    trustBoost: tierConfig.trustBoost,
    apy: tierConfig.apy,
    unlockAt,
  };
}

export async function unstakePab(userId: string, stakingId: string): Promise<any> {
  const stakingRecord = await prisma.stakingRecord.findFirst({
    where: { id: stakingId, userId, status: 'ACTIVE' },
  });

  if (!stakingRecord) {
    return { success: false, error: 'Active staking record not found' };
  }

  if (new Date() < stakingRecord.unlockAt) {
    return {
      success: false,
      error: `PAB is locked until ${stakingRecord.unlockAt.toISOString()}`,
      lockedUntil: stakingRecord.unlockAt,
    };
  }

  const connection = getConnection();
  const platformKey = getPlatformKeypair();
  if (!platformKey) return { success: false, error: 'Platform wallet not configured' };

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: 'User not found' };

  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  // Transfer PAB back to user
  const mintKey = new PublicKey(getPabMint());
  const fromKey = platformKey.publicKey;
  const toKey = new PublicKey(wallet?.address || user.walletAddress || '');

  const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
  const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

  const { Transaction } = await import('@solana/web3.js');
  const transaction = new Transaction();

  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toAccountInfo) {
    const { createAssociatedTokenAccountInstruction } = await import('@solana/spl-token');
    transaction.add(
      createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey)
    );
  }

  const amountRaw = Math.round(stakingRecord.amountPab * Math.pow(10, 9));
  transaction.add(
    createTransferInstruction(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], TOKEN_PROGRAM_ID)
  );

  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromKey;
  transaction.sign(platformKey);

  // Update records
  await prisma.stakingRecord.update({
    where: { id: stakingId },
    data: { status: 'UNSTAKED', unstakedAt: new Date() },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      pabStaked: { decrement: stakingRecord.amountPab },
      trustScore: { decrement: stakingRecord.trustBoost },
    },
  });

  await prisma.wallet.update({
    where: { userId },
    data: { balance: { increment: stakingRecord.amountPab } },
  });

  logger.info(`[PabStaking] User ${userId} unstaked ${stakingRecord.amountPab} PAB`);

  return {
    success: true,
    amount: stakingRecord.amountPab,
    tier: stakingRecord.tier,
  };
}

export async function getStakingStatus(userId: string): Promise<any> {
  const records = await prisma.stakingRecord.findMany({
    where: { userId },
    orderBy: { stakedAt: 'desc' },
  });

  const activeStakes = records.filter(r => r.status === 'ACTIVE');
  const totalStaked = activeStakes.reduce((sum, r) => sum + r.amountPab, 0);
  const totalTrustBoost = activeStakes.reduce((sum, r) => sum + r.trustBoost, 0);

  const tiers = Object.entries(STAKE_TIERS).map(([name, config]) => ({
    tier: name,
    ...config,
    active: activeStakes.some(r => r.tier === name),
  }));

  return {
    records,
    totalStaked,
    totalTrustBoost,
    activeCount: activeStakes.length,
    tiers,
  };
}

export const pabStakingService = {
  stakePab,
  unstakePab,
  getStakingStatus,
  STAKE_TIERS,
};
