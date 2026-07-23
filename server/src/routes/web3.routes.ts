import { Router, Request, Response, NextFunction } from 'express';
import { cryptoService } from '../services/cryptoService';
import { prisma } from '../utils/database';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'web3',
    endpoints: ['/api/v1/web3/status', '/api/v1/web3/escrow/create', '/api/v1/web3/escrow/release', '/api/v1/web3/reputation/:address'],
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
    
    // In production, this would interact with a smart contract to initialize an escrow
    const mockTxHash = `escrow_init_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Store the tx hash on the reservation record (Section 3.1)
    await prisma.reservation.update({
      where: { id: reservationId },
      data: { cryptoDepositTxHash: mockTxHash, depositStatus: 'PENDING' }
    });
    
    res.json({ 
      success: true, 
      data: { 
        txHash: mockTxHash,
        status: 'pending_deposit'
      } 
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
        data: { depositStatus: 'REIMBURSED_TO_BUSINESS' }
      });
    } else if (resolution === 'cancelled') {
      resultHash = await cryptoService.refundEscrowToCustomer(reservationId);
      // Let crypto service handle the refund status logic, but we can enforce it here
    } else {
      res.status(400).json({ success: false, error: 'invalid resolution type' });
      return;
    }
    
    res.json({ success: true, data: { txHash: resultHash, resolution } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/web3/reputation/:address
router.get('/reputation/:address', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    
    // Fetch from our local DB, acting as the portable reputation registry indexer
    const user = await prisma.user.findFirst({
      where: { walletAddress: address },
      include: { _count: { select: { reservations: { where: { status: 'COMPLETED' } } } } }
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'No reputation found for this address on Pabandi.' });
      return;
    }
    
    const noShows = await prisma.reservation.count({
      where: { customerId: user.id, status: 'NO_SHOW' }
    });
    
    const scoreAttestation = {
      address,
      userId: user.id,
      pabandiScore: user.trustScore,
      reliabilityScore: user.reliabilityScore,
      completedBookings: user._count.reservations,
      noShows,
      lastUpdated: new Date().toISOString()
    };
    
    res.json({ success: true, data: scoreAttestation });
  } catch (error) {
    next(error);
  }
});

export default router;
