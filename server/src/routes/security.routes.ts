import { Router, Request, Response } from 'express';
import { jevSecurity } from '../services/jevSecurity.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import type { AuthRequest } from '../middleware/auth.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

/**
 * POST /api/v1/security/check-transaction
 * Jev fraud check on a transaction
 * Body: { from, to, amount, token, userHistory }
 */
router.post('/check-transaction', async (req: Request, res: Response): Promise<any> => {
  try {
    const { from, to, amount, token, userHistory } = req.body;

    if (!from || !to || !amount || !token) {
      return res.status(400).json({
        success: false,
        error: 'from, to, amount, and token are required',
      });
    }

    const result = await jevSecurity.checkTransactionSecurity({
      from,
      to,
      amount: parseFloat(amount),
      token,
      timestamp: Date.now(),
      userHistory: userHistory || {
        totalTransactions: 0,
        totalVolume: 0,
        avgTransactionSize: 0,
        lastTransactionTime: 0,
        disputes: 0,
        trustScore: 50,
      },
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[SecurityRoutes] /check-transaction error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/security/check-agent/:agentId
 * Jev agent risk assessment
 * Body: { agentHistory }
 */
router.post('/check-agent/:agentId', async (req: Request, res: Response): Promise<any> => {
  try {
    const { agentId } = req.params;
    const agent = await prisma.agentProfile.findUnique({ where: { id: agentId } });

    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }

    const completedTasks = await prisma.agentProject.count({
      where: { posterId: agentId, status: 'COMPLETED' },
    });
    const disputedTasks = await prisma.agentProject.count({
      where: { posterId: agentId, status: 'DISPUTED' },
    });

    const result = await jevSecurity.checkAgentSecurity(agentId, {
      completedTasks,
      disputedTasks,
      avgRating: agent.reputation,
      totalEarnings: agent.totalEarned,
      accountAge: Math.floor((Date.now() - agent.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      pabStaked: agent.balancePab,
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[SecurityRoutes] /check-agent error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/v1/security/check-anomaly
 * Jev anomaly detection on user behavior
 * Body: { userId, action, userPattern }
 */
router.post('/check-anomaly', async (req: Request, res: Response): Promise<any> => {
  try {
    const { userId, action, userPattern } = req.body;

    if (!userId || !action) {
      return res.status(400).json({
        success: false,
        error: 'userId and action are required',
      });
    }

    const result = await jevSecurity.detectAnomaly({
      userId,
      action,
      timestamp: Date.now(),
      userPattern: userPattern || {
        usualTimes: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
        usualAmounts: [],
        usualActions: ['login', 'browse', 'book', 'pay'],
      },
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error('[SecurityRoutes] /check-anomaly error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /api/v1/security/stats
 * Security metrics
 */
router.get('/stats', async (_req: Request, res: Response): Promise<any> => {
  try {
    const [
      totalTransactions,
      totalStakes,
      totalEscrows,
      activeEscrows,
      totalAgents,
      activeAgents,
    ] = await Promise.all([
      prisma.payment.count(),
      prisma.stakingRecord.count(),
      prisma.localSaleEscrow.count(),
      prisma.localSaleEscrow.count({ where: { status: { in: ['PENDING', 'FUNDED'] } } }),
      prisma.agentProfile.count(),
      prisma.agentProfile.count({ where: { reputation: { gt: 0 } } }),
    ]);

    return res.json({
      success: true,
      data: {
        transactions: { total: totalTransactions },
        staking: { totalStaked: totalStakes },
        escrow: { total: totalEscrows, active: activeEscrows },
        agents: { total: totalAgents, active: activeAgents },
        securityEngine: 'jev',
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    logger.error('[SecurityRoutes] /stats error:', err.message);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
