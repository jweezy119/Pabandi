import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export const stakeCollateral = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { reservationId, amount } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: userId! },
      include: { wallet: true }
    });

    if (!user?.wallet || user.wallet.balance < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient PAB balance for earnest deposit.' });
    }

    // Deduct from wallet balance and "lock" it as Hamish Jiddiyyah
    await prisma.wallet.update({
      where: { userId: userId! },
      data: { balance: { decrement: amount } }
    });

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: `HAMISH_JIDDIYYAH_${amount}_PAB` }
    });

    res.json({
      success: true,
      message: `${amount} PAB successfully locked as Hamish Jiddiyyah (Earnest Deposit).`
    });

  } catch (error) {
    logger.error('Error locking Hamish Jiddiyyah:', error);
    res.status(500).json({ success: false, error: 'Failed to lock deposit' });
  }
};

export const resolveStake = async (req: AuthRequest, res: Response) => {
  try {
    // Called upon No-Show verification. Business claims actual damages only.
    const { reservationId, actualDamages } = req.body;

    if (actualDamages === undefined || actualDamages < 0) {
      return res.status(400).json({ success: false, error: 'Must specify actual damages incurred (can be 0).' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservation?.cryptoDepositTxHash?.startsWith('HAMISH_JIDDIYYAH_')) {
      return res.status(400).json({ success: false, error: 'No active earnest deposit found for this reservation.' });
    }

    const stakedAmount = parseFloat(reservation.cryptoDepositTxHash.split('_')[2]);
    const damagesToDeduct = Math.min(actualDamages, stakedAmount);
    const refundAmount = stakedAmount - damagesToDeduct;

    // 1. Give damages to business owner
    if (damagesToDeduct > 0) {
      const business = await prisma.business.findUnique({ where: { id: reservation.businessId }});
      if (business?.ownerId) {
        await prisma.wallet.upsert({
          where: { userId: business.ownerId },
          update: { balance: { increment: damagesToDeduct } },
          create: { userId: business.ownerId, balance: damagesToDeduct }
        });
      }
    }

    // 2. Refund excess to customer
    if (refundAmount > 0) {
      await prisma.wallet.update({
        where: { userId: reservation.customerId },
        data: { balance: { increment: refundAmount } }
      });
    }

    // Clear the deposit status
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: `RESOLVED_${damagesToDeduct}_DAMAGES_${refundAmount}_REFUNDED` }
    });

    res.json({
      success: true,
      message: `${stakedAmount} PAB deposit resolved. ${damagesToDeduct} transferred to business for actual damages, ${refundAmount} refunded to customer.`
    });

  } catch (error) {
    logger.error('Error resolving earnest deposit:', error);
    res.status(500).json({ success: false, error: 'Failed to resolve deposit' });
  }
};

export const releaseStake = async (req: AuthRequest, res: Response) => {
  try {
    // Called upon successful check-in or valid cancellation. Returns 100% to customer.
    const { reservationId } = req.body;

    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservation?.cryptoDepositTxHash?.startsWith('HAMISH_JIDDIYYAH_')) {
      return res.status(400).json({ success: false, error: 'No active earnest deposit found for this reservation.' });
    }

    const stakedAmount = parseFloat(reservation.cryptoDepositTxHash.split('_')[2]);

    // Return 100% to customer
    await prisma.wallet.update({
      where: { userId: reservation.customerId },
      data: { balance: { increment: stakedAmount } }
    });

    // Clear the deposit status
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: `RELEASED_${stakedAmount}_PAB` }
    });

    res.json({
      success: true,
      message: `100% of Hamish Jiddiyyah (${stakedAmount} PAB) has been released and refunded to the customer.`
    });

  } catch (error) {
    logger.error('Error releasing earnest deposit:', error);
    res.status(500).json({ success: false, error: 'Failed to release deposit' });
  }
};

// ==========================================
// YIELD STAKING POOL (MUDARABAH PROFIT-SHARING)
// ==========================================

export const getStakingStatus = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const positions = await prisma.stakingPosition.findMany({
      where: { userId, status: 'ACTIVE' }
    });

    const totalStakedByUser = positions.reduce((sum, pos) => sum + pos.amount, 0);

    const allPositions = await prisma.stakingPosition.findMany({
      where: { status: 'ACTIVE' }
    });
    const globalTotalStaked = allPositions.reduce((sum, pos) => sum + pos.amount, 0);

    const estimatedYield = globalTotalStaked > 0 ? 12.5 : 0; // 12.5% placeholder

    res.json({
      success: true,
      totalStaked: totalStakedByUser,
      globalTotalStaked,
      estimatedYield,
      positions
    });
  } catch (error) {
    logger.error('Error fetching staking status:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const stakeYield = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid staking amount' });
    }

    const wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({ success: false, error: 'Insufficient PAB balance in Vault' });
    }

    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId },
        data: { balance: { decrement: amount } }
      }),
      prisma.stakingPosition.create({
        data: {
          userId,
          amount,
          status: 'ACTIVE'
        }
      }),
      prisma.stakeTransaction.create({
        data: {
          userId,
          amount,
          type: 'YIELD_STAKE'
        }
      })
    ]);

    res.json({ success: true, message: `Successfully staked ${amount} PAB` });
  } catch (error) {
    logger.error('Error staking:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

export const unstakeYield = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { positionId } = req.body;
    if (!positionId) {
      return res.status(400).json({ success: false, error: 'Position ID is required' });
    }

    const position = await prisma.stakingPosition.findFirst({
      where: { id: positionId, userId, status: 'ACTIVE' }
    });

    if (!position) {
      return res.status(404).json({ success: false, error: 'Active staking position not found' });
    }

    await prisma.$transaction([
      prisma.stakingPosition.update({
        where: { id: positionId },
        data: { status: 'WITHDRAWN' }
      }),
      prisma.wallet.update({
        where: { userId },
        data: { balance: { increment: position.amount } }
      }),
      prisma.stakeTransaction.create({
        data: {
          userId,
          amount: position.amount,
          type: 'YIELD_UNSTAKE'
        }
      })
    ]);

    res.json({ success: true, message: `Successfully unstaked ${position.amount} PAB` });
  } catch (error) {
    logger.error('Error unstaking:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};
