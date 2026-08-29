/**
 * agentMarketplace.routes.ts — public agent marketplace API.
 *
 *   GET /api/v1/agents              — list active agents with stats
 *   GET /api/v1/agents/:id          — single agent detail
 *   GET /api/v1/agents/:id/bookings — recent bookings for an agent
 */
import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';

const router = Router();

interface AgentStats {
  totalBookings: number;
  completed: number;
  noShows: number;
  cancelled: number;
  completionRate: number;
  totalEarnedPab: number;
  totalRakeSol: number;
}

async function getAgentStats(agentId: string): Promise<AgentStats> {
  const bookings = await prisma.agentBooking.findMany({
    where: { OR: [{ fromAgentId: agentId }, { toAgentId: agentId }] },
    select: { status: true, amountPab: true, feeSol: true },
  });

  const totalBookings = bookings.length;
  const completed = bookings.filter((b) => b.status === 'COMPLETED').length;
  const noShows = bookings.filter((b) => b.status === 'NO_SHOW').length;
  const cancelled = bookings.filter((b) => b.status === 'CANCELLED').length;
  const completionRate = totalBookings ? +(completed / totalBookings).toFixed(2) : 0;
  const totalEarnedPab = +bookings.reduce((s, b) => s + (b.amountPab || 0), 0).toFixed(2);
  const totalRakeSol = +bookings.reduce((s, b) => s + (b.feeSol || 0), 0).toFixed(6);

  return { totalBookings, completed, noShows, cancelled, completionRate, totalEarnedPab, totalRakeSol };
}

// ── GET /api/v1/agents ────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = { isActive: true };
    if (category) where.category = category;
    if (search) {
      where.profileId = { contains: search, mode: 'insensitive' as any };
    }

    const [agents, total] = await Promise.all([
      prisma.web3Agent.findMany({
        where,
        orderBy: { balancePab: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          profileId: true,
          walletAddress: true,
          category: true,
          balancePab: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          stakes: { select: { amountPab: true, slashedPab: true, indexed: true } },
        },
      }),
      prisma.web3Agent.count({ where }),
    ]);

    const items = await Promise.all(
      agents.map(async (a) => {
        const stats = await getAgentStats(a.id);
        const stake = a.stakes?.[0];
        return {
          id: a.id,
          profileId: a.profileId,
          walletAddress: a.walletAddress,
          category: a.category,
          balancePab: a.balancePab,
          stakePab: stake?.amountPab || 0,
          slashedPab: stake?.slashedPab || 0,
          indexed: stake?.indexed || false,
          createdAt: a.createdAt,
          stats,
        };
      }),
    );

    res.json({
      success: true,
      data: {
        items,
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/agents/:id ────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const agent = await prisma.web3Agent.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        profileId: true,
        walletAddress: true,
        category: true,
        balancePab: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        stakes: { select: { amountPab: true, slashedPab: true, indexed: true, vault: true } },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20, select: { type: true, amount: true, txHash: true, createdAt: true } },
      },
    });

    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    const stats = await getAgentStats(agent.id);
    const stake = agent.stakes?.[0];

    res.json({
      success: true,
      data: {
        ...agent,
        stakes: stake || null,
        stats,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/agents/:id/bookings ──────────────────────────────────────────
router.get('/:id/bookings', async (req: Request, res: Response) => {
  try {
    const bookings = await prisma.agentBooking.findMany({
      where: { OR: [{ fromAgentId: req.params.id }, { toAgentId: req.params.id }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ success: true, data: bookings });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
