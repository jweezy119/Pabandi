import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import bs58 from 'bs58';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const REWARD_RATE = 0.02; // 2% of task value

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

export async function distributeAgentReward(params: {
  agentId: string;
  taskType: string;
  taskValue: number;
  userId?: string;
}): Promise<any> {
  const { agentId, taskType, taskValue, userId } = params;

  const rewardAmount = taskValue * REWARD_RATE;

  const agent = await prisma.web3Agent.findUnique({ where: { id: agentId } });
  if (!agent) return { success: false, error: 'Agent not found' };

  const connection = getConnection();
  const platformKey = getPlatformKeypair();
  if (!platformKey) return { success: false, error: 'Platform wallet not configured' };

  const mintKey = new PublicKey(getPabMint());
  const fromKey = platformKey.publicKey;
  const toKey = new PublicKey(agent.walletAddress);

  const fromTokenAccount = await getAssociatedTokenAddress(mintKey, fromKey);
  const toTokenAccount = await getAssociatedTokenAddress(mintKey, toKey);

  const { Transaction } = await import('@solana/web3.js');
  const transaction = new Transaction();

  const toAccountInfo = await connection.getAccountInfo(toTokenAccount);
  if (!toAccountInfo) {
    transaction.add(createAssociatedTokenAccountInstruction(fromKey, toTokenAccount, toKey, mintKey));
  }

  const amountRaw = Math.round(rewardAmount * Math.pow(10, 9));
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
    logger.error(`[AgentReward] On-chain transfer failed: ${err.message}`);
  }

  // Record the reward
  const reward = await prisma.agentReward.create({
    data: {
      agentId,
      userId,
      taskType,
      taskValue,
      rewardPab: rewardAmount,
      txHash: txHash || undefined,
      status: txHash ? 'DISTRIBUTED' : 'PENDING',
      distributedAt: txHash ? new Date() : undefined,
    },
  });

  // Update agent balance
  await prisma.web3Agent.update({
    where: { id: agentId },
    data: { balancePab: { increment: rewardAmount } },
  });

  // Update user's pabEarned if userId provided
  if (userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { pabEarned: { increment: rewardAmount } },
    });
  }

  // Record in agent transaction ledger
  await prisma.agentTransaction.create({
    data: {
      agentId,
      type: 'BONUS',
      amount: rewardAmount,
      fromAddress: platformKey.publicKey.toBase58(),
      toAddress: agent.walletAddress,
      txHash: txHash || `reward:${agentId}:${Date.now()}`,
      metadata: { taskType, taskValue, rewardRate: REWARD_RATE } as any,
    } as any,
  });

  logger.info(`[AgentReward] Distributed ${rewardAmount} PAB to agent ${agentId} for ${taskType}`);

  return {
    success: true,
    reward,
    rewardAmount,
    txHash,
  };
}

export async function getAgentRewards(agentId: string): Promise<any> {
  const rewards = await prisma.agentReward.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
  });

  const totalEarned = rewards
    .filter(r => r.status === 'DISTRIBUTED')
    .reduce((sum, r) => sum + r.rewardPab, 0);

  const pendingRewards = rewards.filter(r => r.status === 'PENDING');
  const totalPending = pendingRewards.reduce((sum, r) => sum + r.rewardPab, 0);

  const agent = await prisma.web3Agent.findUnique({ where: { id: agentId } });

  return {
    rewards,
    totalEarned,
    totalPending,
    currentBalance: agent?.balancePab || 0,
    rewardCount: rewards.length,
  };
}

export async function getUserRewards(userId: string): Promise<any> {
  const rewards = await prisma.agentReward.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  const totalEarned = rewards
    .filter(r => r.status === 'DISTRIBUTED')
    .reduce((sum, r) => sum + r.rewardPab, 0);

  return {
    rewards,
    totalEarned,
    rewardCount: rewards.length,
  };
}

export const agentRewardService = {
  distributeAgentReward,
  getAgentRewards,
  getUserRewards,
  REWARD_RATE,
};
