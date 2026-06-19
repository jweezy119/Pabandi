import { Request, Response } from 'express';
import { accioAgentService } from '../services/ai/accioAgent.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

export const analyzeDemand = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) {
      return res.status(403).json({ error: 'Not authorized for a business' });
    }
    const businessId = business.id;

    // 1. Analyze upcoming demand
    const analysis = await accioAgentService.analyzeUpcomingDemand(businessId);
    
    // 2. Draft order if there are needs
    let draftOrder = null;
    if (analysis.needs.length > 0) {
      // Check if there's already a suggested order recently
      const existing = await prisma.sourcingOrder.findFirst({
        where: { businessId, status: 'SUGGESTED' },
        orderBy: { createdAt: 'desc' }
      });

      if (existing) {
        draftOrder = existing;
      } else {
        draftOrder = await accioAgentService.draftSourcingOrder(businessId, analysis.needs);
      }
    }

    // 3. Fetch existing orders
    const pastOrders = await prisma.sourcingOrder.findMany({
      where: { businessId, status: { not: 'SUGGESTED' } },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      analysis,
      draftOrder,
      pastOrders
    });
  } catch (error) {
    logger.error('Analyze demand error', error);
    res.status(500).json({ error: 'Failed to analyze demand' });
  }
};

export const confirmOrder = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) {
      return res.status(403).json({ error: 'Not authorized for a business' });
    }
    const businessId = business.id;
    const { orderId } = req.params;

    const order = await prisma.sourcingOrder.findUnique({ where: { id: orderId } });
    if (!order || order.businessId !== businessId) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const confirmed = await accioAgentService.confirmOrder(orderId);
    
    res.json(confirmed);
  } catch (error) {
    logger.error('Confirm order error', error);
    res.status(500).json({ error: 'Failed to confirm order' });
  }
};

export const getTrends = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'Not authorized' });

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) return res.status(403).json({ error: 'Not authorized for a business' });

    const trends = await accioAgentService.discoverTrends(business.id);
    res.json({ trends });
  } catch (error) {
    logger.error('Get trends error', error);
    res.status(500).json({ error: 'Failed to discover trends' });
  }
};

export const launchService = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(403).json({ error: 'Not authorized' });

    const business = await prisma.business.findUnique({ where: { ownerId: userId } });
    if (!business) return res.status(403).json({ error: 'Not authorized for a business' });

    const { trendId } = req.params;
    
    // Verify ownership
    const trend = await prisma.trendSuggestion.findUnique({ where: { id: trendId } });
    if (!trend || trend.businessId !== business.id) {
      return res.status(404).json({ error: 'Trend suggestion not found' });
    }

    const launched = await accioAgentService.launchTrendService(trendId);
    res.json({ success: true, service: launched });
  } catch (error) {
    logger.error('Launch service error', error);
    res.status(500).json({ error: 'Failed to launch service' });
  }
};
