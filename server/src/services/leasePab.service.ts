import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const PAB_MINT = 'G811FHWiZrqY1DZKz6dQySpJFPTDfe21B8LRnDqa1z5Y';
const PAB_DISCOUNT_RATE = 0.05;
const AUTO_STAKE_RATE = 0.10;
const LEASE_DEPOSIT_APY = 0.02;

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
// LEASE PAB INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

export async function createLeaseWithPabDeposit(params: {
  leaseId: string;
  tenantEmail: string;
  depositAmount: number;
  userId?: string;
}): Promise<any> {
  const { leaseId, tenantEmail, depositAmount, userId } = params;

  const lease = await prisma.propertyLease.findUnique({ where: { id: leaseId } });
  if (!lease) return { success: false, error: 'Lease not found' };

  // Check if deposit already exists
  const existing = await prisma.leaseDeposit.findUnique({ where: { leaseId } });
  if (existing) return { success: false, error: 'Lease deposit already exists' };

  // Create deposit record
  const deposit = await prisma.leaseDeposit.create({
    data: {
      leaseId,
      tenantEmail,
      depositAmount,
      interestRate: LEASE_DEPOSIT_APY,
      status: 'HELD',
    },
  });

  await logPaymentFlow({
    flowType: 'LEASE_DEPOSIT',
    referenceId: leaseId,
    referenceType: 'PropertyLease',
    amount: depositAmount,
    token: 'PAB',
    status: 'COMPLETED',
    metadata: { tenantEmail, depositId: deposit.id },
  });

  // If userId provided, deduct PAB from wallet
  if (userId) {
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (wallet && wallet.balance >= depositAmount) {
      await prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: depositAmount } },
      });
    }
  }

  return { success: true, deposit, depositAmount };
}

export async function returnLeaseDeposit(params: {
  leaseId: string;
  userId?: string;
  earlyTermination?: boolean;
}): Promise<any> {
  const { leaseId, userId, earlyTermination } = params;

  const deposit = await prisma.leaseDeposit.findUnique({ where: { leaseId } });
  if (!deposit) return { success: false, error: 'Lease deposit not found' };
  if (deposit.status !== 'HELD') {
    return { success: false, error: `Deposit already ${deposit.status}` };
  }

  const lease = await prisma.propertyLease.findUnique({ where: { id: leaseId } });
  if (!lease) return { success: false, error: 'Lease not found' };

  // Calculate interest (simple: APY * deposit * years held)
  const heldMs = Date.now() - deposit.heldAt.getTime();
  const heldYears = heldMs / (365.25 * 24 * 60 * 60 * 1000);
  const interest = earlyTermination ? 0 : deposit.depositAmount * deposit.interestRate * heldYears;

  let returnAmount: number;
  let releaseType: string;

  if (earlyTermination) {
    // 50% slash
    returnAmount = deposit.depositAmount * 0.5;
    releaseType = 'SLASHED';
  } else {
    returnAmount = deposit.depositAmount + interest;
    releaseType = 'FULL';
  }

  // Update deposit record
  const updated = await prisma.leaseDeposit.update({
    where: { leaseId },
    data: {
      status: earlyTermination ? 'SLASHED' : 'RETURNED',
      interestEarned: interest,
      releasedAt: new Date(),
      releaseType,
    },
  });

  // Return PAB to user wallet
  if (userId && returnAmount > 0) {
    await prisma.wallet.update({
      where: { userId },
      data: { balance: { increment: returnAmount } },
    });
  }

  await logPaymentFlow({
    flowType: 'LEASE_END',
    referenceId: leaseId,
    referenceType: 'PropertyLease',
    amount: returnAmount,
    token: 'PAB',
    status: 'COMPLETED',
    metadata: {
      earlyTermination,
      depositAmount: deposit.depositAmount,
      interest,
      releaseType,
    },
  });

  return {
    success: true,
    deposit: updated,
    returnAmount,
    interest,
    releaseType,
  };
}

export async function getLeaseDepositStatus(leaseId: string): Promise<any> {
  const deposit = await prisma.leaseDeposit.findUnique({ where: { leaseId } });
  if (!deposit) return null;

  // Calculate current interest
  const heldMs = Date.now() - deposit.heldAt.getTime();
  const heldDays = Math.floor(heldMs / (24 * 60 * 60 * 1000));
  const currentInterest = deposit.depositAmount * deposit.interestRate * (heldDays / 365.25);

  return {
    ...deposit,
    heldDays,
    currentInterest,
    totalValue: deposit.depositAmount + currentInterest,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PAB PAYMENT FLOW
// ═══════════════════════════════════════════════════════════════════════════════

export async function processPabPayment(params: {
  rentPaymentId: string;
  tenantEmail: string;
  propertyId: string;
  unitId?: string;
  amountUsdc: number;
  tokenUsed: 'USDC' | 'PAB';
  userId?: string;
}): Promise<any> {
  const { rentPaymentId, tenantEmail, propertyId, unitId, amountUsdc, tokenUsed, userId } = params;

  const rentPayment = await prisma.rentPayment.findUnique({ where: { id: rentPaymentId } });
  if (!rentPayment) return { success: false, error: 'Rent payment not found' };

  const existing = await prisma.pabPayment.findUnique({ where: { rentPaymentId } });
  if (existing) return { success: false, error: 'Payment already processed' };

  let amountPab = 0;
  let discountApplied = 0;
  let stakedAmount = 0;
  let finalUsdc = amountUsdc;
  let status = 'PENDING';
  let txHash: string | undefined;

  if (tokenUsed === 'PAB') {
    // 5% discount
    discountApplied = amountUsdc * PAB_DISCOUNT_RATE;
    finalUsdc = amountUsdc - discountApplied;
    amountPab = finalUsdc; // 1 PAB = 1 USDC
    stakedAmount = amountPab * AUTO_STAKE_RATE;

    // Deduct PAB from user wallet
    if (userId) {
      const wallet = await prisma.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.balance < amountPab) {
        return { success: false, error: `Insufficient PAB balance. Need ${amountPab} PAB` };
      }

      const connection = getConnection();
      const platformKey = getPlatformKeypair();
      if (platformKey) {
        const mintKey = new PublicKey(PAB_MINT);
        const fromKey = new PublicKey(wallet.address || '');
        const toKey = platformKey.publicKey;

        const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
        const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

        const { Transaction } = await import('@solana/web3.js');
        const transaction = new Transaction();

        const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
        if (!toAccountInfo) {
          transaction.add(createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey));
        }

        const amountRaw = Math.round(amountPab * Math.pow(10, 9));
        transaction.add(
          createTransferInstruction(fromTokenAccount, toTokenAccount, fromKey, amountRaw, [], TOKEN_PROGRAM_ID)
        );

        const { blockhash } = await connection.getRecentBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = fromKey;

        try {
          // In production, user signs client-side
          // For simulation, we just record the intent
          txHash = `pab_payment:${rentPaymentId}:${Date.now()}`;
          status = 'CONFIRMED';
        } catch (err: any) {
          logger.error(`[PabPayment] Transfer failed: ${err.message}`);
        }
      }

      // Deduct from wallet
      await prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: amountPab } },
      });

      // Auto-stake portion for trust score
      if (stakedAmount > 0) {
        const existingStake = await prisma.stakingRecord.findFirst({
          where: { userId, status: 'ACTIVE' },
        });
        if (existingStake) {
          await prisma.stakingRecord.update({
            where: { id: existingStake.id },
            data: { amountPab: { increment: stakedAmount } },
          });
        } else {
          await prisma.stakingRecord.create({
            data: {
              userId,
              tier: 'BRONZE',
              amountPab: stakedAmount,
              trustBoost: Math.round(stakedAmount / 10),
              status: 'ACTIVE',
              unlockAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          });
        }
        // Update user trust score
        await prisma.user.update({
          where: { id: userId },
          data: { trustScore: { increment: Math.round(stakedAmount / 10) } },
        });
      }
    }
  } else {
    // USDC payment - just record
    status = 'CONFIRMED';
    txHash = `usdc_payment:${rentPaymentId}:${Date.now()}`;
  }

  // Create PAB payment record
  const pabPayment = await prisma.pabPayment.create({
    data: {
      rentPaymentId,
      tenantEmail,
      propertyId,
      unitId,
      amountUsdc: finalUsdc,
      amountPab,
      tokenUsed,
      discountApplied,
      stakedAmount,
      txHash,
      status,
      confirmedAt: status === 'CONFIRMED' ? new Date() : undefined,
    },
  });

  // Update rent payment status
  if (status === 'CONFIRMED') {
    await prisma.rentPayment.update({
      where: { id: rentPaymentId },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  await logPaymentFlow({
    flowType: 'RENT_PAYMENT',
    referenceId: rentPaymentId,
    referenceType: 'RentPayment',
    amount: tokenUsed === 'PAB' ? amountPab : amountUsdc,
    token: tokenUsed,
    status: status === 'CONFIRMED' ? 'COMPLETED' : 'FAILED',
    txHash,
    metadata: {
      tenantEmail,
      propertyId,
      discountApplied,
      stakedAmount,
    },
  });

  return {
    success: status === 'CONFIRMED',
    pabPayment,
    amountPab,
    discountApplied,
    stakedAmount,
    txHash,
  };
}

export async function getPaymentHistory(tenantEmail: string): Promise<any> {
  const usdcPayments = await prisma.rentPayment.findMany({
    where: { tenantEmail },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const pabPayments = await prisma.pabPayment.findMany({
    where: { tenantEmail },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return {
    usdcPayments: usdcPayments.map((p: any) => ({
      id: p.id,
      date: p.paidAt || p.dueDate,
      amount: p.amount,
      token: 'USDC',
      status: p.status,
      method: p.method,
    })),
    pabPayments: pabPayments.map((p: any) => ({
      id: p.id,
      date: p.confirmedAt || p.createdAt,
      amount: p.amountPab,
      token: 'PAB',
      status: p.status,
      discountApplied: p.discountApplied,
      stakedAmount: p.stakedAmount,
      txHash: p.txHash,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGENT PAB EARNINGS
// ═══════════════════════════════════════════════════════════════════════════════

export async function rewardAgentForTask(params: {
  agentId: string;
  taskType: 'TENANT_SCREENING' | 'LEASE_SIGNING' | 'INSPECTION_COMPLETION' | 'MAINTENANCE_COORDINATION';
  taskDescription: string;
  propertyId?: string;
  unitId?: string;
  tenantEmail?: string;
  rewardAmount: number;
  autoConvert?: boolean;
}): Promise<any> {
  const agent = await prisma.agentProfile.findUnique({ where: { id: params.agentId } });
  if (!agent) return { success: false, error: 'Agent not found' };

  // Create task reward record
  const reward = await prisma.agentPabTaskReward.create({
    data: {
      agentId: params.agentId,
      taskType: params.taskType,
      taskDescription: params.taskDescription,
      propertyId: params.propertyId,
      unitId: params.unitId,
      tenantEmail: params.tenantEmail,
      rewardAmount: params.rewardAmount,
      autoConvert: params.autoConvert || false,
      usdcEquivalent: params.autoConvert ? params.rewardAmount : undefined,
      status: 'PENDING',
    },
  });

  // Update agent balance
  await prisma.agentProfile.update({
    where: { id: params.agentId },
    data: { balancePab: { increment: params.rewardAmount } },
  });

  // If auto-convert, deduct PAB and credit USDC
  if (params.autoConvert) {
    await prisma.agentProfile.update({
      where: { id: params.agentId },
      data: {
        balancePab: { decrement: params.rewardAmount },
        balanceUsdc: { increment: params.rewardAmount },
      },
    });
    await prisma.agentPabTaskReward.update({
      where: { id: reward.id },
      data: { status: 'CONVERTED', distributedAt: new Date() },
    });
  } else {
    await prisma.agentPabTaskReward.update({
      where: { id: reward.id },
      data: { status: 'DISTRIBUTED', distributedAt: new Date() },
    });
  }

  await logPaymentFlow({
    flowType: 'AGENT_REWARD',
    referenceId: reward.id,
    referenceType: 'AgentPabTaskReward',
    amount: params.rewardAmount,
    token: 'PAB',
    status: 'COMPLETED',
    metadata: {
      agentId: params.agentId,
      taskType: params.taskType,
      autoConvert: params.autoConvert,
    },
  });

  return {
    success: true,
    reward: { ...reward, status: params.autoConvert ? 'CONVERTED' : 'DISTRIBUTED' },
    agentBalance: agent.balancePab + params.rewardAmount,
  };
}

export async function getAgentPabEarnings(agentId: string): Promise<any> {
  const agent = await prisma.agentProfile.findUnique({ where: { id: agentId } });
  if (!agent) return { success: false, error: 'Agent not found' };

  const rewards = await prisma.agentPabTaskReward.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });

  const totalEarned = rewards
    .filter(r => r.status === 'DISTRIBUTED' || r.status === 'CONVERTED')
    .reduce((s, r) => s + r.rewardAmount, 0);

  const pendingRewards = rewards.filter(r => r.status === 'PENDING');
  const totalPending = pendingRewards.reduce((s, r) => s + r.rewardAmount, 0);

  const convertedRewards = rewards.filter(r => r.status === 'CONVERTED');
  const totalConverted = convertedRewards.reduce((s, r) => s + r.rewardAmount, 0);

  return {
    agent: {
      id: agent.id,
      name: agent.name,
      balancePab: agent.balancePab,
      balanceUsdc: agent.balanceUsdc,
      reputation: agent.reputation,
    },
    rewards,
    totalEarned,
    totalPending,
    totalConverted,
    rewardCount: rewards.length,
  };
}

export async function setAutoConvertPreference(agentId: string, autoConvert: boolean): Promise<any> {
  await prisma.agentProfile.update({
    where: { id: agentId },
    data: {},
  });

  return { success: true, autoConvert };
}

export const leasePabService = {
  createLeaseWithPabDeposit,
  returnLeaseDeposit,
  getLeaseDepositStatus,
  processPabPayment,
  getPaymentHistory,
  rewardAgentForTask,
  getAgentPabEarnings,
  setAutoConvertPreference,
  PAB_DISCOUNT_RATE,
  AUTO_STAKE_RATE,
  LEASE_DEPOSIT_APY,
};
