import { Router, Request, Response, NextFunction } from 'express';
import { whatsAppSmartService } from '../services/whatsapp.smart.service';

const router = Router();

// Adapter: WhatsApp advanced capabilities
router.get('/capabilities', (_req: Request, res: Response) => {
  res.json({ success: true, capabilities: whatsAppSmartService.capabilities() });
});

// Adapter: execute a smart WhatsApp action from external systems/CRM
router.post('/smart-action', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { intent, customerPhone, businessPhone, message } = req.body || {};
    if (!intent) {
      return res.status(400).json({ success: false, error: 'intent is required' });
    }
    const reply = await whatsAppSmartService.runSmartAction(intent, {
      customerPhone,
      businessPhone,
      message,
    });
    res.json({ success: true, data: reply });
  } catch (error) {
    next(error);
  }
});

export default router;
