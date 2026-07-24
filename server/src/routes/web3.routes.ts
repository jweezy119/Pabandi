import { Router, Request, Response, NextFunction } from 'express';
import { cryptoService } from '../services/cryptoService';
import { prisma } from '../utils/database';
import { isDemoMode } from '../utils/env';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'web3',
    endpoints: [
      '/api/v1/web3/status',
      '/api/v1/web3/escrow/create',
      '/api/v1/web3/escrow/release',
      '/api/v1/web3/reputation/:address',
      '/api/v1/web3/escrow/receipts/:reservationId',
    ],
    demoMode: isDemoMode(),
    requiredEnv: [
      process.env.BSC_RPC_URL || process.env.BSC_RPC_TESTNET_URL ? 'BSC_RPC_URL/BSC_RPC_TESTNET_URL' : null,
      process.env.ESCROW_ORACLE_PRIVATE_KEY ? 'ESCROW_ORACLE_PRIVATE_KEY' : null,
      process.env.ESCROW_CONTRACT_ADDRESS ? 'ESCROW_CONTRACT_ADDRESS' : null,
    ].filter(Boolean),
  });
});

// POST /api/v1/web3/escrow/create
router.post('/escrow/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId, businessAddress, amount, currency } = req.body;
    if (!reservationId || !businessAddress || !amount) {
      res.status(400).json({ success: false, error: 'reservationId, businessAddress, and amount are required' });
      return;
    }

    if (isDemoMode()) {
      const mockTxHash = `escrow_init_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { cryptoDepositTxHash: mockTxHash, depositStatus: 'PENDING' },
      });
      res.json({
        success: true,
        data: {
          txHash: mockTxHash,
          status: 'pending_deposit',
          simulated: true,
        },
      });
      return;
    }

    const missing = [
      !process.env.BSC_RPC_URL && !process.env.BSC_RPC_TESTNET_URL && 'BSC_RPC_URL',
      !process.env.ESCROW_ORACLE_PRIVATE_KEY && 'ESCROW_ORACLE_PRIVATE_KEY',
      !process.env.ESCROW_CONTRACT_ADDRESS && 'ESCROW_CONTRACT_ADDRESS',
    ].filter(Boolean);
    if (missing.length) {
      res.status(501).json({ success: false, error: `On-chain escrow requires ${missing.join(', ')}` });
      return;
    }

    await prisma.reservation.update({
      where: { id: reservationId },
      data: { depositStatus: 'PENDING_WEB3' },
    });
    res.json({
      success: true,
      data: {
        reservationId,
        status: 'pending_deposit',
        simulated: false,
      },
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/web3/escrow/release
router.post('/escrow/release', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId, resolution } = req.body;
    if (!reservationId || !resolution) {
      res.status(400).json({ success: false, error: 'reservationId and resolution are required' });
      return;
    }

    let resultHash;
    if (resolution === 'completed') {
      resultHash = await cryptoService.releaseEscrowToBusiness(reservationId);
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { depositStatus: 'REIMBURSED_TO_BUSINESS' },
      });
    } else if (resolution === 'cancelled') {
      resultHash = await cryptoService.refundEscrowToCustomer(reservationId);
    } else {
      res.status(400).json({ success: false, error: 'invalid resolution type' });
      return;
    }

    res.json({ success: true, data: { txHash: resultHash, resolution } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/web3/escrow/receipts/:reservationId
router.get('/escrow/receipts/:reservationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });

    if (!reservation || !reservation.depositRequired) {
      res.status(404).json({ success: false, error: 'Escrow receipt not found for this reservation' });
      return;
    }

    const business = await prisma.business.findUnique({ where: { id: reservation.businessId } });
    res.json({
      success: true,
      data: {
        reservationId: reservation.id,
        status: reservation.status,
        depositStatus: reservation.depositStatus,
        depositAmount: reservation.depositAmount,
        currency: 'USD',
        txHash: reservation.cryptoDepositTxHash,
        scheduledAt: `${reservation.reservationDate.toISOString().split('T')[0]} ${reservation.reservationTime}`,
        customerId: reservation.customerId,
        businessId: reservation.businessId,
        businessCategory: business?.category || null,
        createdAt: reservation.createdAt,
        updatedAt: reservation.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/web3/reputation/:address
router.get('/reputation/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;

    const user = await prisma.user.findFirst({
      where: { walletAddress: address },
      include: { _count: { select: { reservations: { where: { status: 'COMPLETED' } } } } },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'No reputation found for this address on Pabandi.' });
      return;
    }

    const noShows = await prisma.reservation.count({
      where: { customerId: user.id, status: 'NO_SHOW' },
    });

    const scoreAttestation = {
      address,
      userId: user.id,
      pabandiScore: user.trustScore,
      reliabilityScore: user.reliabilityScore,
      completedBookings: user._count.reservations,
      noShows,
      lastUpdated: new Date().toISOString(),
    };

    res.json({ success: true, data: scoreAttestation });
  } catch (error) {
    next(error);
  }
});

export default router;
