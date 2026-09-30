import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';

const router = Router();

router.post('/message', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { recipientAgentId, message, context } = req.body;
    if (!recipientAgentId || !message) {
      return res.status(400).json({ success: false, error: 'recipientAgentId and message required' });
    }

    const msg = await prisma.agentMessage.create({
      data: {
        senderAgentId: req.user!.id,
        recipientAgentId,
        message,
        context: context || {},
        status: 'delivered',
      },
    });

    return res.json({ success: true, data: msg });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[AgentComm] send message error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/messages', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const messages = await prisma.agentMessage.findMany({
      where: {
        OR: [
          { senderAgentId: req.user!.id },
          { recipientAgentId: req.user!.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ success: true, data: messages });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.post('/task', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, assignedAgentId, dueAt, metadata } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'title required' });

    const task = await prisma.agentTask.create({
      data: {
        title,
        description: description || null,
        priority: priority || 'medium',
        status: 'open',
        createdByAgentId: req.user!.id,
        assignedAgentId: assignedAgentId || null,
        dueAt: dueAt ? new Date(dueAt) : null,
        metadata: metadata || {},
      },
    });

    return res.json({ success: true, data: task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[AgentComm] create task error: ${message}`);
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/tasks', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { status } = req.query;
    const where: Record<string, unknown> = {
      OR: [
        { createdByAgentId: req.user!.id },
        { assignedAgentId: req.user!.id },
      ],
    };
    if (where) where.status = status;

    const tasks = await prisma.agentTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json({ success: true, data: tasks });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.patch('/task/:id', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { status, result } = req.body;
    const task = await prisma.agentTask.findFirst({
      where: {
        id: req.params.id,
        OR: [
          { createdByAgentId: req.user!.id },
          { assignedAgentId: req.user!.id },
        ],
      },
    });
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });

    const updated = await prisma.agentTask.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status }),
        ...(result !== undefined && { result }),
        ...(status === 'completed' && { completedAt: new Date() }),
      },
    });
    return res.json({ success: true, data: updated });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/analytics', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const agentId = req.user!.id;

    const [
      totalTasks,
      completedTasks,
      activeBookings,
      totalBookings,
      avgTrustScore,
      earnings,
    ] = await Promise.all([
      prisma.agentTask.count({ where: { OR: [{ createdByAgentId: agentId }, { assignedAgentId: agentId }] } }),
      prisma.agentTask.count({ where: { OR: [{ createdByAgentId: agentId }, { assignedAgentId: agentId }], status: 'completed' } }),
      prisma.booking.count({ where: { clientId: agentId, status: 'confirmed' } }),
      prisma.booking.count({ where: { clientId: agentId } }),
      prisma.user.findUnique({ where: { id: agentId }, select: { reliabilityScore: true } }),
      prisma.agentReward.aggregate({ where: { agentId }, _sum: { taskValue: true, rewardPab: true } }),
    ]);

    return res.json({
      success: true,
      data: {
        tasks: { total: totalTasks, completed: completedTasks, rate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0 },
        bookings: { total: totalBookings, active: activeBookings },
        trust: { score: avgTrustScore?.reliabilityScore || 0 },
        earnings: { total: (earnings._sum.taskValue || 0) + (earnings._sum.rewardPab || 0) },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.post('/consent', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { agentId, scopes, expiresIn } = req.body;
    if (!agentId || !scopes) {
      return res.status(400).json({ success: false, error: 'agentId and scopes required' });
    }

    const consent = await prisma.agentConsent.create({
      data: {
        userId: req.user!.id,
        agentId,
        scopes,
        expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: 'active',
      },
    });

    return res.json({ success: true, data: consent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.get('/consents', authenticate, apiLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const consents = await prisma.agentConsent.findMany({
      where: { userId: req.user!.id, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: consents });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

router.delete('/consent/:id', authenticate, writeLimiter, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.agentConsent.update({
      where: { id: req.params.id, userId: req.user!.id },
      data: { status: 'revoked' },
    });
    return res.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
