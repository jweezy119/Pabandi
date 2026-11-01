import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

router.get('/agents/:passportId/earnings', async (req: Request, res: Response) => {
  try {
    const { passportId } = req.params;

    const wallet = await prisma.agentWallet.findFirst({
      where: { passportId },
      include: { earningsLedger: { orderBy: { createdAt: 'desc' } } },
    });

    if (!wallet) {
      return res.json({
        success: true,
        data: {
          wallet: null,
          ledger: [],
          onchainBalance: 0,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        wallet: {
          pdaAddress: wallet.pdaAddress,
          pabBalance: wallet.pabBalance,
          usdcBalance: wallet.usdcBalance,
        },
        ledger: wallet.earningsLedger,
        onchainBalance: wallet.pabBalance,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[AgentEarnings] error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/agents/:passportId/export', async (req: Request, res: Response) => {
  try {
    const { passportId } = req.params;
    const { format } = req.query;

    const wallet = await prisma.agentWallet.findFirst({
      where: { passportId },
      include: { earningsLedger: { orderBy: { createdAt: 'asc' } } },
    });

    if (!wallet || !wallet.earningsLedger.length) {
      return res.status(404).json({ success: false, error: 'No earnings found' });
    }

    if (format === 'csv') {
      const csv = [
        'Date,Type,Mint,Amount,Reference ID,TX Signature',
        ...wallet.earningsLedger.map(entry =>
          `${entry.createdAt.toISOString()},${entry.type},${entry.mint},${entry.amount},${entry.referenceId || ''},${entry.txSignature}`
        ),
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="agent-earnings-${passportId}.csv"`);
      return res.send(csv);
    }

    return res.json({ success: true, data: wallet.earningsLedger });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[AgentEarnings] export error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
