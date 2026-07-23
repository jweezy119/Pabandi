import { Router, Request, Response } from 'express';
import { whatsAppSmartService } from '../services/whatsapp.smart.service';

const router = Router();

// Stable advanced adapter: exposes capability metadata plus a single smart-action entrypoint
router.get('/capabilities', (req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: whatsAppSmartService.capabilities(),
  });
});

// Stable advanced adapter: run an advanced WhatsApp intent flow as an API call
router.post('/smart-action', async (req: Request, res: Response) => {
  const { intent, context } = req.body || {};
  if (!intent) {
    return res.status(400).json({ success: false, error: 'intent is required' });
  }
  const reply = await whatsAppSmartService.runSmartAction(intent, context);
  res.json({ success: true, data: { reply } });
});

export default router;
