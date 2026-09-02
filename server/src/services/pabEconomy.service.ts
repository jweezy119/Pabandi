import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── PAB Economy Service ────────────────────────────────────────────────────
// Arcade-token model: earn by doing things, spend on services, stake for tiers.
// Zero capital needed — PAB is issued as users earn it, burned as they spend it.

const DEFAULT_EARN_RULES = [
  { action: 'list_item', amount: 5, description: 'List an item on the marketplace' },
  { action: 'screen_tenant', amount: 10, description: 'Screen a tenant or buyer' },
  { action: 'refer_user', amount: 25, description: 'Refer a new user' },
  { action: 'verify_identity', amount: 20, description: 'Verify your identity' },
  { action: 'complete_sale', amount: 15, description: 'Complete a verified sale' },
  { action: 'win_dispute', amount: 15, description: 'Win a dispute' },
  { action: 'safemeet_complete', amount: 10, description: 'Complete a SafeMeet exchange' },
  { action: 'add_property', amount: 5, description: 'Add a property' },
  { action: 'add_tenant', amount: 3, description: 'Add a tenant' },
  { action: 'leave_review', amount: 2, description: 'Leave a review' },
  { action: 'connect_wallet', amount: 15, description: 'Connect your wallet' },
];

const DEFAULT_SPEND_RULES = [
  { action: 'background_check', cost: 10, description: 'Run a background check' },
  { action: 'escrow_protection', cost: 5, description: 'Escrow protection for a sale' },
  { action: 'safemeet_schedule', cost: 3, description: 'Schedule a SafeMeet' },
  { action: 'featured_listing', cost: 20, description: 'Feature your listing' },
  { action: 'dispute_file', cost: 10, description: 'File a dispute' },
  { action: 'local_agent_hire', cost: 50, description: 'Hire a local agent' },
];

const DEFAULT_STAKE_TIERS = [
  { tier: 'BRONZE', minStake: 100, durationDays: 30, benefit: 'Basic trust badge', feeDiscount: 1, searchBoost: false, badge: true },
  { tier: 'SILVER', minStake: 500, durationDays: 90, benefit: 'Priority in search + 5% fee discount', feeDiscount: 5, searchBoost: true, badge: true },
  { tier: 'GOLD', minStake: 2000, durationDays: 180, benefit: '10% fee discount + arbitration voting', feeDiscount: 10, searchBoost: true, badge: true },
  { tier: 'PLATINUM', minStake: 10000, durationDays: 365, benefit: 'Revenue share + governance votes', feeDiscount: 15, searchBoost: true, badge: true },
];

export async function initializePabEconomy() {
  // Seed earn rules
  for (const rule of DEFAULT_EARN_RULES) {
    await prisma.pabEarnRule.upsert({
      where: { action: rule.action },
      update: rule,
      create: rule,
    });
  }

  // Seed spend rules
  for (const rule of DEFAULT_SPEND_RULES) {
    await prisma.pabSpendRule.upsert({
      where: { action: rule.action },
      update: rule,
      create: rule,
    });
  }

  // Seed stake tiers
  for (const tier of DEFAULT_STAKE_TIERS) {
    await prisma.pabStakeTier.upsert({
      where: { tier: tier.tier },
      update: tier,
      create: tier,
    });
  }

  // Initialize treasury
  const treasury = await prisma.pabTreasury.findFirst();
  if (!treasury) {
    await prisma.pabTreasury.create({ data: {} });
  }
}

// ── Wallet ──────────────────────────────────────────────────────────────────

export async function getOrCreateWallet(userId: string) {
  let wallet = await prisma.pabWallet.findUnique({ where: { userId } });
  if (!wallet) {
    wallet = await prisma.pabWallet.create({ data: { userId, balance: 0 } });
  }
  return wallet;
}

export async function getWallet(userId: string) {
  return prisma.pabWallet.findUnique({
    where: { userId },
    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
}

// ── Earn ────────────────────────────────────────────────────────────────────

export async function earnPab(userId: string, action: string, refType?: string, refId?: string) {
  const rule = await prisma.pabEarnRule.findUnique({ where: { action } });
  if (!rule || !rule.isActive) return null;

  const wallet = await getOrCreateWallet(userId);

  const tx = await prisma.pabTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'EARN',
      amount: rule.amount,
      action,
      description: rule.description,
      refType,
      refId,
      balanceAfter: wallet.balance + rule.amount,
    },
  });

  await prisma.pabWallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: rule.amount }, totalEarned: { increment: rule.amount } },
  });

  return tx;
}

// ── Spend ───────────────────────────────────────────────────────────────────

export async function spendPab(userId: string, action: string, refType?: string, refId?: string) {
  const rule = await prisma.pabSpendRule.findUnique({ where: { action } });
  if (!rule || !rule.isActive) return null;

  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < rule.cost) {
    throw new Error(`Insufficient PAB balance. Need ${rule.cost}, have ${wallet.balance}`);
  }

  const tx = await prisma.pabTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'SPEND',
      amount: -rule.cost,
      action,
      description: rule.description,
      refType,
      refId,
      balanceAfter: wallet.balance - rule.cost,
    },
  });

  await prisma.pabWallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: rule.cost }, totalSpent: { increment: rule.cost } },
  });

  // Burn the spent PAB (deflationary)
  await prisma.pabWallet.update({
    where: { id: wallet.id },
    data: { totalBurned: { increment: rule.cost } },
  });

  return tx;
}

// ── Stake ───────────────────────────────────────────────────────────────────

export async function stakePab(userId: string, tier: string) {
  const tierDef = await prisma.pabStakeTier.findUnique({ where: { tier } });
  if (!tierDef) throw new Error('Invalid tier');

  const wallet = await getOrCreateWallet(userId);
  if (wallet.balance < tierDef.minStake) {
    throw new Error(`Insufficient PAB balance. Need ${tierDef.minStake}, have ${wallet.balance}`);
  }

  await prisma.pabWallet.update({
    where: { id: wallet.id },
    data: {
      balance: { decrement: tierDef.minStake },
      stakedAmt: { increment: tierDef.minStake },
      stakedTier: tier,
      stakedAt: new Date(),
      stakeExpires: new Date(Date.now() + tierDef.durationDays * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.pabTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'STAKE',
      amount: -tierDef.minStake,
      action: `stake_${tier.toLowerCase()}`,
      description: `Staked ${tierDef.minStake} PAB for ${tier}`,
      balanceAfter: wallet.balance - tierDef.minStake,
    },
  });

  return prisma.pabWallet.findUnique({ where: { userId } });
}

// ── Unstake ─────────────────────────────────────────────────────────────────

export async function unstakePab(userId: string) {
  const wallet = await prisma.pabWallet.findUnique({ where: { userId } });
  if (!wallet || wallet.stakedAmt === 0) throw new Error('No staked PAB');

  if (wallet.stakeExpires && wallet.stakeExpires > new Date()) {
    throw new Error('Stake has not expired yet');
  }

  const stakedAmt = wallet.stakedAmt;
  const tier = wallet.stakedTier;

  await prisma.pabWallet.update({
    where: { userId },
    data: {
      balance: { increment: stakedAmt },
      stakedAmt: 0,
      stakedTier: null,
      stakedAt: null,
      stakeExpires: null,
    },
  });

  await prisma.pabTransaction.create({
    data: {
      walletId: wallet.id,
      type: 'UNSTAKE',
      amount: stakedAmt,
      action: 'unstake',
      description: `Unstaked ${stakedAmt} PAB from ${tier}`,
      balanceAfter: wallet.balance + stakedAmt,
    },
  });

  return prisma.pabWallet.findUnique({ where: { userId } });
}

// ── Treasury ────────────────────────────────────────────────────────────────

export async function recordPlatformFee(solAmount: number) {
  await prisma.pabTreasury.updateMany({
    data: { totalSolEarned: { increment: solAmount }, totalSolToPool: { increment: solAmount * 0.35 } },
  });
}

export async function getTreasury() {
  return prisma.pabTreasury.findFirst();
}

// ── Stats ───────────────────────────────────────────────────────────────────

export async function getPabStats() {
  const [totalWallets, totalTransactions, totalBurned, treasury, earnRules, spendRules, stakeTiers] = await Promise.all([
    prisma.pabWallet.count(),
    prisma.pabTransaction.count(),
    prisma.pabWallet.aggregate({ _sum: { totalBurned: true } }),
    prisma.pabTreasury.findFirst(),
    prisma.pabEarnRule.findMany({ where: { isActive: true } }),
    prisma.pabSpendRule.findMany({ where: { isActive: true } }),
    prisma.pabStakeTier.findMany(),
  ]);

  return {
    totalWallets,
    totalTransactions,
    totalBurned: totalBurned._sum.totalBurned || 0,
    treasury,
    earnRules,
    spendRules,
    stakeTiers,
  };
}
