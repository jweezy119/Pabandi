import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { trustCore } from '../trust/trust-core';

const router = Router();
const prisma = new PrismaClient();

// List Activities
router.get('/', async (req, res) => {
  const { businessId, clientId, dealId, type } = req.query;
  try {
    const where: any = { businessId: String(businessId) };
    if (clientId) where.clientId = String(clientId);
    if (dealId) where.dealId = String(dealId);
    if (type && type !== 'All') where.type = String(type);
    
    // In Activities inbox, we don't return TASK if we want a separate Task page, 
    // but the unified inbox can include Tasks.
    
    const activities = await prisma.crmActivity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { name: true, passportId: true } },
        deal: { select: { title: true } }
      }
    });
    res.json(activities);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Activity
router.post('/', async (req, res) => {
  const { businessId, clientId, dealId, type, title, description, authorName } = req.body;
  try {
    const activity = await prisma.crmActivity.create({
      data: {
        businessId,
        clientId,
        dealId,
        type: type || 'NOTE',
        title,
        description,
        authorName
      },
      include: { client: true }
    });

    if (clientId && activity.client?.passportId) {
      // Activity logged attaches to client timeline/trust
      await trustCore.emit('activity.logged', {
        clientId,
        passportId: activity.client.passportId,
        activityType: type
      });
    }

    res.json(activity);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
