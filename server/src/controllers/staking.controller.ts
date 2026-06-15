import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export const stakeCollateral = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { reservationId, amount } = req.body;

    // Simulate staking logic (locking off-chain balance)
    // In production, this would lock tokens in a Solana escrow program or hold it in the DB state
    const user = await prisma.user.findUnique({
      where: { id: userId! },
      include: { wallet: true }
    });

    if (!user?.wallet || user.wallet.balance < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient PAB balance for staking.' });
    }

    // Deduct from wallet balance and "lock" it
    await prisma.wallet.update({
      where: { userId: userId! },
      data: { balance: { decrement: amount } }
    });

    // We use cryptoDepositTxHash to store the stake state for now
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: `STAKED_${amount}_PAB` }
    });

    res.json({
      success: true,
      message: `${amount} PAB successfully staked as collateral.`
    });

  } catch (error) {
    logger.error('Error staking collateral:', error);
    res.status(500).json({ success: false, error: 'Failed to stake collateral' });
  }
};

export const slashStake = async (req: AuthRequest, res: Response) => {
  try {
    // This would typically be called by the system (cron job) or business upon No-Show verification
    const { reservationId } = req.body;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservation?.cryptoDepositTxHash?.startsWith('STAKED_')) {
      return res.status(400).json({ success: false, error: 'No active stake found for this reservation.' });
    }

    const stakedAmount = parseFloat(reservation.cryptoDepositTxHash.split('_')[1]);

    // 100% goes to the business (per current logic)
    const business = await prisma.business.findUnique({ where: { id: reservation.businessId }});
    if (business?.ownerId) {
      // Credit the business owner's wallet
      await prisma.wallet.upsert({
        where: { userId: business.ownerId },
        update: { balance: { increment: stakedAmount } },
        create: { userId: business.ownerId, balance: stakedAmount }
      });
    }

    // Clear the stake status
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: `SLASHED_${stakedAmount}_PAB` }
    });

    res.json({
      success: true,
      message: `${stakedAmount} PAB slashed and 100% transferred to the business as compensation.`
    });

  } catch (error) {
    logger.error('Error slashing stake:', error);
    res.status(500).json({ success: false, error: 'Failed to slash stake' });
  }
};
