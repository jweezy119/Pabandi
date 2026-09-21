import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

// Leads
router.get('/leads', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const leads = await prisma.crmLead.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: leads });
  } catch (e: any) { res.status(500).json({ error: 'Failed to list leads' }); }
});

router.post('/leads', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const lead = await prisma.crmLead.create({
      data: { ...req.body, ownerId: userId, status: 'NEW' },
    });
    res.status(201).json({ success: true, data: lead });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to create lead' }); }
});

router.get('/leads/:id', authenticate, async (req: any, res: Response) => {
  try {
    const lead = await prisma.crmLead.findUnique({ where: { id: req.params.id } });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json({ success: true, data: lead });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get lead details' }); }
});

router.put('/leads/:id/stage', authenticate, async (req: any, res: Response) => {
  try {
    const { stage } = req.body;
    const lead = await prisma.crmLead.update({
      where: { id: req.params.id },
      data: { stage },
    });
    res.json({ success: true, data: lead });
  } catch (e: any) { res.status(500).json({ error: 'Failed to update lead stage' }); }
});

// Deals
router.post('/deals', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const deal = await prisma.crmDeal.create({
      data: { ...req.body, ownerId: userId, status: 'OPEN' },
    });
    res.status(201).json({ success: true, data: deal });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to create deal' }); }
});

router.get('/deals', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const deals = await prisma.crmDeal.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: deals });
  } catch (e: any) { res.status(500).json({ error: 'Failed to list deals' }); }
});

// Activities
router.post('/activities', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const activity = await prisma.crmActivity.create({
      data: { ...req.body, ownerId: userId },
    });
    res.status(201).json({ success: true, data: activity });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to add activity' }); }
});

// Stats
router.get('/stats', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const [totalLeads, totalDeals, openDeals, wonDeals, totalRevenue] = await Promise.all([
      prisma.crmLead.count({ where: { ownerId: userId } }),
      prisma.crmDeal.count({ where: { ownerId: userId } }),
      prisma.crmDeal.count({ where: { ownerId: userId, status: 'OPEN' } }),
      prisma.crmDeal.count({ where: { ownerId: userId, status: 'WON' } }),
      prisma.crmDeal.aggregate({ where: { ownerId: userId, status: 'WON' }, _sum: { value: true } }),
    ]);
    res.json({
      success: true,
      data: {
        totalLeads,
        totalDeals,
        openDeals,
        wonDeals,
        totalRevenue: totalRevenue._sum.value || 0,
        conversionRate: totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0,
      },
    });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get pipeline stats' }); }
});

export default router;
