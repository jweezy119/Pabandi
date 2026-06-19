import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { cryptoService } from '../services/cryptoService';
import { blockchainService } from '../services/blockchain.service';
import { badgeService } from '../services/badge.service';
import { dashscopeService } from '../services/ai/dashscope.service';
import { CustomError } from '../middleware/errorHandler';
import { prisma } from '../utils/database';
import { BadgeTier } from '../types/blockchain.types';

export const getMyWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const data = await cryptoService.getWalletData(req.user!.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getBusinessRewards = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'BUSINESS_OWNER' && req.user!.role !== 'ADMIN') {
      throw new CustomError('Business account required', 403);
    }
    const data = await cryptoService.getBusinessRewardsSummary(req.user!.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

export const getRewardRules = async (_req: Request, res: Response) => {
  res.json({ success: true, data: cryptoService.getPublicRewardRules() });
};

export const getContractAddresses = async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      pabToken:         process.env.PAB_TOKEN_ADDRESS   || null,
      escrow:           process.env.ESCROW_CONTRACT_ADDRESS || null,
      soulbound:        process.env.SOULBOUND_CONTRACT_ADDRESS || null,
      chainId:          process.env.BLOCKCHAIN_CHAIN_ID || '56',
      network:          process.env.BLOCKCHAIN_NETWORK  || 'bscMainnet',
      deployed:         !!(process.env.PAB_TOKEN_ADDRESS),
    },
  });
};

export const connectSolanaWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { address } = req.body;
    if (!address || typeof address !== 'string' || address.length < 32) {
      throw new CustomError('Valid Solana wallet address is required', 400);
    }
    const wallet = await cryptoService.connectSolanaWallet(req.user!.id, address.trim());
    res.json({
      success: true,
      message: 'Solana wallet connected for $PAB payouts',
      data: { address: wallet.address, chain: 'solana' },
    });
  } catch (error) {
    next(error);
  }
};

export const requestSolanaTransfer = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { amount } = req.body;
    const wallet = await prisma.wallet.findUnique({ where: { userId: req.user!.id } });
    if (!wallet?.address || wallet.currency !== 'SOL') {
      throw new CustomError('Connect a Phantom (Solana) wallet first', 400);
    }
    const transferAmount = Number(amount) || wallet.balance;
    if (transferAmount <= 0 || transferAmount > wallet.balance) {
      throw new CustomError('Invalid transfer amount', 400);
    }

    const rewardRecord = await prisma.cryptoReward.create({
      data: {
        userId: req.user!.id,
        amount: -transferAmount,
        type: 'SOLANA_TRANSFER_REQUEST',
        status: 'PENDING',
        txHash: null,
      },
    });

    const transferResult = await blockchainService.executeSolanaTransfer(wallet.address, transferAmount);

    if (transferResult.error) {
      await prisma.cryptoReward.update({
        where: { id: rewardRecord.id },
        data: { status: 'FAILED' }
      });
      throw new CustomError('Failed to transfer $PAB to Solana: ' + transferResult.error, 500);
    }

    // Update the reward to completed and deduct the balance from internal DB
    await prisma.$transaction([
      prisma.cryptoReward.update({
        where: { id: rewardRecord.id },
        data: {
          status: 'COMPLETED',
          txHash: transferResult.txHash
        }
      }),
      prisma.wallet.update({
        where: { userId: req.user!.id },
        data: { balance: { decrement: transferAmount } }
      })
    ]);

    res.json({
      success: true,
      message: 'Transfer successful! $PAB has been minted to your Solana wallet.',
      data: {
        to: wallet.address,
        amount: transferAmount,
        chain: 'solana',
        status: 'completed',
        txHash: transferResult.txHash
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/crypto/mint-badge
 * Mints a Soulbound NFT badge for the authenticated user's connected wallet.
 * Computes eligible tier from user's reservation history + reliability score.
 */
export const mintBadge = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Get user's wallet address
    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet?.address) {
      throw new CustomError(
        'Connect a wallet first (Phantom or MetaMask) before minting badges',
        400
      );
    }

    // Compute badge status
    const badge = await badgeService.computeBadgeStatus(userId);
    const showRate = badge.totalBookings > 0 ? badge.attendanceRate : 100;

    // Generate AI Trust Profile using Alibaba DashScope mock
    const aiTrustProfile = await dashscopeService.generateTrustProfile(userId);

    const mintResult = await blockchainService.checkAndMintEligibleBadge(
      wallet.address,
      badge.pseudonymousId,
      badge.reliabilityScore,
      badge.totalBookings,
      showRate,
      aiTrustProfile
    );

    if (!mintResult) {
      throw new CustomError(
        'Complete at least 1 booking with 70%+ show rate to earn your first badge',
        400
      );
    }

    res.json({
      success: true,
      data: {
        ...mintResult,
        badge: {
          score: badge.reliabilityScore,
          tier: badge.tier,
          totalBookings: badge.totalBookings,
          attendanceRate: badge.attendanceRate,
          aiTrustProfile: aiTrustProfile,
        },
        contractAddresses: {
          soulbound: process.env.SOULBOUND_CONTRACT_ADDRESS || null,
          network:   process.env.BLOCKCHAIN_NETWORK || 'bscMainnet',
        },
      },
      message: mintResult.success
        ? `${mintResult.tierName} Soulbound Badge ${mintResult.chain === 'solana' ? 'ready to mint' : 'minted'} successfully!`
        : 'Badge minting queued — will be processed shortly.',
    });
  } catch (error) {
    next(error);
  }
};
