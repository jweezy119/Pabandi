/**
 * webhook.routes.ts — admin webhook delivery endpoints.
 *
 *   POST /api/v1/webhooks/deliver/now  — force process webhook queue
 *   GET  /api/v1/webhooks/queue        — view pending webhooks
 */
import { Router, Request, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { webhookDeliveryService } from '../services/webhookDelivery.service';

const router = Router();

router.use(authenticate);
router.use(authorize('ADMIN'));

router.post('/deliver/now', async (_req: Request, res: Response) => {
  try {
    const result = await webhookDeliveryService.processWebhookQueue();
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const [pending, delivered] = await Promise.all([
      prisma.webhookDelivery.count({ where: { status: 'QUEUED' } }),
      prisma.webhookDelivery.count({ where: { status: 'DELIVERED' } }),
    ]);
    res.json({ success: true, data: { pending, delivered } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
