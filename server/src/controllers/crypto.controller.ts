import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { cryptoService } from '../services/cryptoService';
import { blockchainService } from '../services/blockchain.service';
import { badgeService } from '../services/badge.service';
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

    await prisma.cryptoReward.create({
      data: {
        userId: req.user!.id,
        amount: -transferAmount,
        type: 'SOLANA_TRANSFER_REQUEST',
        status: 'PENDING',
        txHash: null,
      },
    });

    res.json({
      success: true,
      message: 'Transfer queued. $PAB will be sent to your Solana wallet shortly.',
      data: {
        to: wallet.address,
        amount: transferAmount,
        chain: 'solana',
        status: 'pending',
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

    // Determine tier from badge data
    const tierMap: Record<string, BadgeTier> = {
      Bronze: BadgeTier.Bronze,
      Silver: BadgeTier.Silver,
      Gold:   BadgeTier.Gold,
      Platinum: BadgeTier.Platinum,
    };

    // Compute tier from booking stats
    const showRate = badge.totalBookings > 0
      ? Math.round((badge.attendanceRate))
      : 100;

    let tier: BadgeTier | null = null;
    if (badge.totalBookings >= 25 && showRate >= 97) tier = BadgeTier.Platinum;
    else if (badge.totalBookings >= 10 && showRate >= 90) tier = BadgeTier.Gold;
    else if (badge.totalBookings >= 5  && showRate >= 80) tier = BadgeTier.Silver;
    else if (badge.totalBookings >= 1  && showRate >= 70) tier = BadgeTier.Bronze;

    if (tier === null) {
      throw new CustomError(
        'Complete at least 1 booking with 70%+ show rate to earn your first badge',
        400
      );
    }

    // Detect chain from wallet
    const isPhantom = wallet.currency === 'SOL';
    const chain = isPhantom ? 'solana' : 'bsc';

    let mintResult;
    if (isPhantom) {
      // Solana: return PDA + instruction for client-side signing (Anchor)
      const { PublicKey } = await import('@solana/web3.js');
      const BADGE_PROGRAM_ID = new PublicKey(
        process.env.SOLANA_BADGE_PROGRAM_ID || 'BadgPkeyPabandiReliabilityBadge1111111111111'
      );
      const owner = new PublicKey(wallet.address);
      const [pda] = PublicKey.findProgramAddressSync(
        [Buffer.from('badge'), owner.toBuffer(), Buffer.from([tier])],
        BADGE_PROGRAM_ID
      );
      mintResult = {
        success: true,
        chain: 'solana',
        tier,
        tierName: ['Bronze Patron', 'Silver Reliable', 'Gold Trustee', 'Platinum Oracle'][tier],
        badgePDA: pda.toBase58(),
        note: 'Sign the Anchor transaction in your Phantom wallet to finalize minting.',
      };
    } else {
      // BSC: mint via server relayer
      mintResult = await blockchainService.mintSoulboundBadge(
        wallet.address,
        tier,
        badge.pseudonymousId,
        badge.reliabilityScore,
        badge.totalBookings
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
        },
        contractAddresses: {
          soulbound: process.env.SOULBOUND_CONTRACT_ADDRESS || null,
          network:   process.env.BLOCKCHAIN_NETWORK || 'bscMainnet',
        },
      },
      message: mintResult.success
        ? `${mintResult.tierName} Soulbound Badge ${chain === 'solana' ? 'ready to mint' : 'minted'} successfully!`
        : 'Badge minting queued — will be processed shortly.',
    });
  } catch (error) {
    next(error);
  }
};
