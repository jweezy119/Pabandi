import { Router, Request, Response, NextFunction } from 'express';
import { cryptoService } from '../services/cryptoService';
import { prisma } from '../utils/database';
import { isDemoMode, web3RequiredEnv, web3ContractAddress, web3ExplorerBase, defaultDepositModeWeb3 } from '../utils/env';

const router = Router();

const chainLabel = web3RequiredEnv().chain;
const explorerBase = web3ExplorerBase();
const escrowContract = web3ContractAddress();
const explorerUrl = (txHash: string) => `${explorerBase}/tx/${txHash}`;

router.get('/status', (_req: Request, res: Response) => {
  const env = web3RequiredEnv();
  res.json({
    success: true,
    service: 'web3',
    mode: env.depositDefaultWeb3 ? 'default-web3' : 'optional',
    chain: env.chain,
    depositDefaultWeb3: env.depositDefaultWeb3,
    network: env.chain,
    explorerBase,
    contract: escrowContract || null,
    endpoints: [
      '/api/v1/web3/status',
      '/api/v1/web3/escrow/create',
      '/api/v1/web3/escrow/release',
      '/api/v1/web3/reputation/:address',
      '/api/v1/web3/escrow/receipts/:reservationId',
    ],
    demoMode: isDemoMode(),
    requiredEnv: [
      env.privateKey ? 'ESCROW_ORACLE_PRIVATE_KEY' : null,
      env.contract ? 'ESCROW_CONTRACT_ADDRESS' : null,
      env.rpc ? 'WEB3_RPC_URL/BSC_RPC_URL' : null,
    ].filter(Boolean),
  });
});

const parseOnChainDeposit = (body: any) => {
  if (!body) return null;
  if (body.transactionHash || body.txHash) return String(body.transactionHash || body.txHash);
  if (body.cryptoDepositTxHash) return String(body.cryptoDepositTxHash);
  return null;
};

// POST /api/v1/web3/escrow/create
router.post('/escrow/create', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId, businessAddress, amount, currency } = req.body;
    if (!reservationId || !businessAddress || !amount) {
      res.status(400).json({ success: false, error: 'reservationId, businessAddress, and amount are required' });
      return;
    }

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) {
      res.status(404).json({ success: false, error: 'Reservation not found' });
      return;
    }

    if (isDemoMode()) {
      const mockTxHash = `escrow_init_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { cryptoDepositTxHash: mockTxHash, depositStatus: 'PENDING_WEB3' },
      });
      res.json({
        success: true,
        data: {
          txHash: mockTxHash,
          status: 'pending_deposit',
          simulated: true,
          chain: chainLabel,
          explorerUrl: explorerUrl(mockTxHash),
        },
      });
      return;
    }

    const txHash = parseOnChainDeposit(req.body);
    if (txHash) {
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { cryptoDepositTxHash: txHash, depositStatus: 'PENDING_WEB3' },
      });
      res.json({
        success: true,
        data: {
          reservationId,
          status: 'pending_deposit',
          txHash,
          chain: chainLabel,
          explorerUrl: explorerUrl(txHash),
          simulated: false,
        },
      });
      return;
    }

    const missing = [
      !process.env.WEB3_RPC_URL && !process.env.BSC_RPC_TESTNET_URL && !process.env.BSC_RPC_URL && 'WEB3_RPC_URL/BSC_RPC_URL',
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
        chain: chainLabel,
        explorerBase,
        contract: escrowContract,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/escrow/release', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId, resolution } = req.body;
    if (!reservationId || !resolution) {
      res.status(400).json({ success: false, error: 'reservationId and resolution are required' });
      return;
    }

    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
    if (!reservation) {
      res.status(404).json({ success: false, error: 'Reservation not found' });
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
      await cryptoService.refundEscrowToCustomer(reservationId);
      const afterRefund = await prisma.reservation.findUnique({ where: { id: reservationId }, select: { cryptoDepositTxHash: true } });
      resultHash = afterRefund?.cryptoDepositTxHash || null;
      await prisma.reservation.update({
        where: { id: reservationId },
        data: { depositStatus: resultHash ? 'PENDING_WEB3' : 'PENDING' },
      });
    } else {
      res.status(400).json({ success: false, error: 'invalid resolution type' });
      return;
    }

    const payload: any = { success: true, data: { txHash: resultHash, resolution } };
    if (resultHash) {
      payload.data.txLink = explorerUrl(resultHash);
      payload.data.chain = chainLabel;
    }

    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get('/escrow/receipts/:reservationId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reservationId } = req.params;
    const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });

    if (!reservation || !reservation.depositRequired) {
      res.status(404).json({ success: false, error: 'Escrow receipt not found for this reservation' });
      return;
    }

    const business = await prisma.business.findUnique({ where: { id: reservation.businessId } });
    const txHash = reservation.cryptoDepositTxHash;
    res.json({
      success: true,
      data: {
        reservationId: reservation.id,
        status: reservation.status,
        depositStatus: reservation.depositStatus,
        depositAmount: reservation.depositAmount,
        currency: 'USD',
        txHash,
        txLink: txHash ? explorerUrl(txHash) : null,
        chain: chainLabel,
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
      escrowDefaultMode: defaultDepositModeWeb3(),
      chain: chainLabel,
    };

    res.json({ success: true, data: scoreAttestation });
  } catch (error) {
    next(error);
  }
});

export default router;
