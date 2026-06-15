import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { logger } from '../utils/logger';

// Use the default devnet RPC, or the one from ENV if set
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

export const getBalances = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // 1. Get Off-Chain (Database) Balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const offChainBalance = user.wallet?.balance || 0;
    let onChainBalance = 0;

    // 2. Get On-Chain (Solana) Balance if they have linked a wallet
    if (user.wallet?.address && process.env.SOLANA_PAB_MINT_ADDRESS) {
      try {
        const userPubKey = new PublicKey(user.wallet.address);
        const mintPubKey = new PublicKey(process.env.SOLANA_PAB_MINT_ADDRESS);

        const ata = await getAssociatedTokenAddress(mintPubKey, userPubKey);
        
        const tokenAccountInfo = await connection.getTokenAccountBalance(ata);
        if (tokenAccountInfo.value.uiAmount !== null) {
          onChainBalance = tokenAccountInfo.value.uiAmount;
        }
      } catch (solErr: any) {
        // If the ATA doesn't exist yet, it throws an error. We just treat it as 0 balance.
        logger.debug(`Could not fetch Solana balance for ${user.wallet.address}: ${solErr.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        offChainBalance,
        onChainBalance,
        totalBalance: offChainBalance + onChainBalance,
        solanaWalletAddress: user.wallet?.address || null,
        mintAddress: process.env.SOLANA_PAB_MINT_ADDRESS || null
      }
    });

  } catch (error) {
    logger.error('Error fetching wallet balances:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch balances' });
  }
};
