import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAB_MINT = 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
const PAB_DISCOUNT_RATE = 0.05; // 5% discount for PAB payments
const AUTO_STAKE_RATE = 0.10; // 10% auto-stake for trust score
const PAB_PRICE_USDC = 1.0; // 1 PAB = 1 USDC (simplified; in production use oracle)

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

/**
 * Log payment flow for verification and audit trail
 */
async function logPaymentFlow(params: {
  flowType: string;
  referenceId: string;
  referenceType: string;
  amount: number;
  token: string;
  fromAddress?: string;
  toAddress?: string;
  txHash?: string;
  status?: string;
  metadata?: any;
}): Promise<any> {
  return prisma.paymentFlowLog.create({
    data: {
      flowType: params.flowType,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      amount: params.amount,
      token: params.token,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      txHash: params.txHash,
      status: params.status || 'INITIATED',
      metadata: params.metadata,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRM PAB ANALYTICS
// ═══════════════════════════════════════════════════════════════════════════════

export interface PabBalanceInfo {
  managerId: string;
  totalPabBalance: number;
  totalPabStaked: number;
  tenantBalances: { tenantId: string; email: string; balance: number }[];
}

export interface StakingOverview {
  managerId: string;
  totalStaked: number;
  tenantStakes: { tenantId: string; email: string; amount: number; tier: string }[];
  tiers: { tier: string; count: number; totalAmount: number }[];
}

export interface RevenueAnalytics {
  managerId: string;
  totalUsdcRevenue: number;
  totalPabRevenue: number;
  totalRevenueUsdc: number;
  byMonth: { month: string; usdc: number; pab: number; totalUsdc: number }[];
  byProperty: { propertyId: string; title: string; usdc: number; pab: number }[];
}

export async function getManagerPabBalance(managerId: string): Promise<PabBalanceInfo> {
  const tenants = await prisma.propertyTenant.findMany({
    where: { managerId },
    select: { id: true, email: true },
  });

  const tenantBalances = await Promise.all(
    tenants.map(async (t) => {
      const wallet = await prisma.wallet.findFirst({
        where: { user: { email: t.email } },
      });
      return { tenantId: t.id, email: t.email, balance: wallet?.balance || 0 };
    })
  );

  const totalPabBalance = tenantBalances.reduce((s, t) => s + t.balance, 0);

  // Get staked amounts from StakingRecord
  const stakedRecords = await prisma.stakingRecord.findMany({
    where: { status: 'ACTIVE' },
    include: { user: true },
  });

  // Filter by tenants belonging to this manager
  const tenantEmails = new Set(tenants.map(t => t.email));
  const tenantStakes = stakedRecords.filter(s => s.user?.email && tenantEmails.has(s.user.email));
  const totalPabStaked = tenantStakes.reduce((s, r) => s + r.amountPab, 0);

  return { managerId, totalPabBalance, totalPabStaked, tenantBalances };
}

export async function getStakingOverview(managerId: string): Promise<StakingOverview> {
  const tenants = await prisma.propertyTenant.findMany({
    where: { managerId },
    select: { id: true, email: true },
  });
  const tenantEmails = tenants.map(t => t.email);

  const stakedRecords = await prisma.stakingRecord.findMany({
    where: { status: 'ACTIVE' },
    include: { user: true },
  });

  const tenantStakes = stakedRecords
    .filter(s => s.user?.email && tenantEmails.includes(s.user.email))
    .map(s => ({
      tenantId: tenants.find(t => t.email === s.user?.email)?.id || '',
      email: s.user?.email || '',
      amount: s.amountPab,
      tier: s.tier,
    }));

  const totalStaked = tenantStakes.reduce((s, t) => s + t.amount, 0);

  // Aggregate by tier
  const tierMap = new Map<string, { count: number; totalAmount: number }>();
  for (const stake of tenantStakes) {
    const existing = tierMap.get(stake.tier) || { count: 0, totalAmount: 0 };
    existing.count++;
    existing.totalAmount += stake.amount;
    tierMap.set(stake.tier, existing);
  }
  const tiers = Array.from(tierMap.entries()).map(([tier, data]) => ({ tier, ...data }));

  return { managerId, totalStaked, tenantStakes, tiers };
}

export async function getRevenueAnalytics(managerId: string): Promise<RevenueAnalytics> {
  // Get all rent payments for this manager's properties
  const properties = await prisma.propertyManagerProperty.findMany({
    where: { managerId },
    select: { id: true, title: true },
  });
  const propertyIds = properties.map(p => p.id);

  const rentPayments = await prisma.rentPayment.findMany({
    where: { propertyId: { in: propertyIds } },
    orderBy: { paidAt: 'asc' },
  });

  const pabPayments = await prisma.pabPayment.findMany({
    where: { propertyId: { in: propertyIds } },
  });

  // Aggregate by month
  const monthlyMap = new Map<string, { usdc: number; pab: number }>();
  for (const p of rentPayments.filter(p => p.status === 'PAID' && p.paidAt)) {
    const month = p.paidAt!.toISOString().slice(0, 7);
    const existing = monthlyMap.get(month) || { usdc: 0, pab: 0 };
    existing.usdc += p.amount;
    monthlyMap.set(month, existing);
  }
  for (const p of pabPayments.filter(pp => pp.status === 'CONFIRMED')) {
    const month = p.createdAt.toISOString().slice(0, 7);
    const existing = monthlyMap.get(month) || { usdc: 0, pab: 0 };
    existing.pab += p.amountPab;
    monthlyMap.set(month, existing);
  }

  const byMonth = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      usdc: data.usdc,
      pab: data.pab,
      totalUsdc: data.usdc + data.pab * PAB_PRICE_USDC,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Aggregate by property
  const byProperty = properties.map(prop => {
    const propRent = rentPayments.filter(r => r.propertyId === prop.id && r.status === 'PAID');
    const propPab = pabPayments.filter(p => p.propertyId === prop.id && p.status === 'CONFIRMED');
    const usdc = propRent.reduce((s, r) => s + r.amount, 0);
    const pab = propPab.reduce((s, p) => s + p.amountPab, 0);
    return { propertyId: prop.id, title: prop.title, usdc, pab };
  });

  const totalUsdcRevenue = byMonth.reduce((s, m) => s + m.usdc, 0);
  const totalPabRevenue = byMonth.reduce((s, m) => s + m.pab, 0);
  const totalRevenueUsdc = totalUsdcRevenue + totalPabRevenue * PAB_PRICE_USDC;

  return {
    managerId,
    totalUsdcRevenue,
    totalPabRevenue,
    totalRevenueUsdc,
    byMonth,
    byProperty,
  };
}

export interface TenantRiskWithPab {
  tenantId: string;
  email: string;
  riskScore: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
  pabStaked: number;
  pabBalance: number;
  adjustedRiskScore: number;
  factors: { label: string; impact: number }[];
}

export async function getTenantRiskWithPabScoring(tenantId: string): Promise<TenantRiskWithPab | null> {
  const tenant = await prisma.propertyTenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return null;

  // Base risk from CRM automation service
  const baseRisk = await prisma.propertyTenant.findUnique({ where: { id: tenantId } });

  // Calculate PAB-based adjustment
  const wallet = await prisma.wallet.findFirst({ where: { user: { email: tenant.email } } });
  const stakingRecords = await prisma.stakingRecord.findMany({
    where: { userId: wallet?.userId || '', status: 'ACTIVE' },
  });

  const pabStaked = stakingRecords.reduce((s, r) => s + r.amountPab, 0);
  const pabBalance = wallet?.balance || 0;

  // PAB staking reduces risk (up to 20 points reduction for high staking)
  const stakeScore = Math.min(pabStaked / 100, 20); // 100 PAB staked = 1 point, max 20
  const balanceScore = Math.min(pabBalance / 500, 10); // 500 PAB balance = 1 point, max 10
  const pabAdjustment = stakeScore + balanceScore;

  // Start with base risk factors
  const factors: { label: string; impact: number }[] = [];
  let baseScore = 100;

  // Payment history
  const ledger = await prisma.tenantLedger.findMany({ where: { tenantId } });
  const lateFees = ledger.filter(l => l.type === 'LATE_FEE').length;
  const totalPayments = ledger.filter(l => l.type === 'RENT').length;
  const lateRatio = totalPayments > 0 ? lateFees / totalPayments : 0;
  const paymentPenalty = Math.min(lateRatio * 50, 50);
  baseScore -= paymentPenalty;
  if (paymentPenalty > 0) factors.push({ label: 'Late payment ratio', impact: -paymentPenalty });

  // PAB adjustment (positive)
  baseScore += pabAdjustment;
  if (pabAdjustment > 0) factors.push({ label: 'PAB staking/balance boost', impact: pabAdjustment });

  // Screening band
  const screening = await prisma.propertyScreening.findFirst({
    where: { tenantEmail: tenant.email },
    orderBy: { screenedAt: 'desc' },
  });
  if (screening) {
    const bandPenalty = screening.band === 'HIGH' ? 30 : screening.band === 'MEDIUM' ? 10 : 0;
    baseScore -= bandPenalty;
    if (bandPenalty > 0) factors.push({ label: `Screening: ${screening.band}`, impact: -bandPenalty });
  }

  const adjustedRiskScore = Math.max(0, Math.min(100, Math.round(baseScore)));
  const riskBand: 'LOW' | 'MEDIUM' | 'HIGH' = adjustedRiskScore >= 70 ? 'LOW' : adjustedRiskScore >= 40 ? 'MEDIUM' : 'HIGH';

  return {
    tenantId,
    email: tenant.email,
    riskScore: adjustedRiskScore,
    riskBand,
    pabStaked,
    pabBalance,
    adjustedRiskScore,
    factors,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BULK PAB REWARDS DISTRIBUTION
// ═══════════════════════════════════════════════════════════════════════════════

export async function createBulkPabReward(params: {
  managerId: string;
  name: string;
  description?: string;
  recipients: { contactId?: string; email: string; amount: number }[];
}): Promise<any> {
  const totalAmount = params.recipients.reduce((s, r) => s + r.amount, 0);

  const reward = await prisma.crmPabReward.create({
    data: {
      managerId: params.managerId,
      name: params.name,
      description: params.description,
      totalAmount,
      recipientCount: params.recipients.length,
      status: 'DRAFT',
      recipients: {
        create: params.recipients.map(r => ({
          contactId: r.contactId,
          email: r.email,
          amount: r.amount,
          status: 'PENDING',
        })),
      },
    },
    include: { recipients: true },
  });

  await logPaymentFlow({
    flowType: 'BULK_REWARD_CREATED',
    referenceId: reward.id,
    referenceType: 'CrmPabReward',
    amount: totalAmount,
    token: 'PAB',
    status: 'INITIATED',
    metadata: { recipientCount: params.recipients.length },
  });

  return reward;
}

export async function distributeBulkPabReward(rewardId: string): Promise<any> {
  const reward = await prisma.crmPabReward.findUnique({
    where: { id: rewardId },
    include: { recipients: true },
  });
  if (!reward) return { success: false, error: 'Reward not found' };

  const platformKey = getPlatformKeypair();
  if (!platformKey) return { success: false, error: 'Platform wallet not configured' };

  const connection = getConnection();
  const mintKey = new PublicKey(PAB_MINT);
  const fromKey = platformKey.publicKey;
  const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);

  let sentCount = 0;
  let failedCount = 0;

  for (const recipient of reward.recipients) {
    if (recipient.status !== 'PENDING') continue;

    try {
      // Find user wallet by email
      const user = await prisma.user.findUnique({ where: { email: recipient.email } });
      if (!user) {
        await prisma.crmPabRewardRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED' },
        });
        failedCount++;
        continue;
      }

      const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
      if (!wallet?.address) {
        await prisma.crmPabRewardRecipient.update({
          where: { id: recipient.id },
          data: { status: 'FAILED' },
        });
        failedCount++;
        continue;
      }

      const toKey = new PublicKey(wallet.address);
      const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

      const { Transaction } = await import('@solana/web3.js');
      const transaction = new Transaction();

      const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
      if (!toAccountInfo) {
        transaction.add(createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey));
      }

      const amountRaw = Math.round(recipient.amount * Math.pow(10, 9));
      transaction.add(
        createTransferInstruction(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], TOKEN_PROGRAM_ID)
      );

      const { blockhash } = await connection.getRecentBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKey;
      transaction.sign(platformKey);

      let txHash: string | undefined;
      try {
        txHash = await connection.sendRawTransaction(transaction.serialize());
        await connection.confirmTransaction(txHash, 'confirmed');
      } catch (err: any) {
        logger.error(`[CrmPabReward] Transfer failed for ${recipient.email}: ${err.message}`);
      }

      await prisma.crmPabRewardRecipient.update({
        where: { id: recipient.id },
        data: {
          status: txHash ? 'SENT' : 'FAILED',
          txHash: txHash,
          sentAt: txHash ? new Date() : undefined,
        },
      });

      if (txHash) {
        // Update user wallet balance
        await prisma.wallet.update({
          where: { userId: user.id },
          data: { balance: { increment: recipient.amount } },
        });
        sentCount++;
      } else {
        failedCount++;
      }
    } catch (err: any) {
      logger.error(`[CrmPabReward] Recipient ${recipient.email} failed: ${err.message}`);
      await prisma.crmPabRewardRecipient.update({
        where: { id: recipient.id },
        data: { status: 'FAILED' },
      });
      failedCount++;
    }
  }

  const finalStatus = failedCount === 0 ? 'DISTRIBUTED' : sentCount > 0 ? 'PARTIAL' : 'FAILED';
  await prisma.crmPabReward.update({
    where: { id: rewardId },
    data: {
      status: finalStatus,
      distributedAt: new Date(),
    },
  });

  await logPaymentFlow({
    flowType: 'BULK_REWARD_DISTRIBUTED',
    referenceId: rewardId,
    referenceType: 'CrmPabReward',
    amount: reward.totalAmount,
    token: 'PAB',
    status: finalStatus === 'DISTRIBUTED' ? 'COMPLETED' : 'FAILED',
    metadata: { sentCount, failedCount },
  });

  return { success: true, sentCount, failedCount, status: finalStatus };
}

export const crmPabService = {
  getManagerPabBalance,
  getStakingOverview,
  getRevenueAnalytics,
  getTenantRiskWithPabScoring,
  createBulkPabReward,
  distributeBulkPabReward,
  PAB_DISCOUNT_RATE,
  AUTO_STAKE_RATE,
  PAB_PRICE_USDC,
};
