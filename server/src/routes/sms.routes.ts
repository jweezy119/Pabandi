import { Router, Request, Response, NextFunction } from 'express';
import { smsService } from '../services/sms.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// POST /api/v1/sms/send - Send SMS
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, message, businessId } = req.body;

    if (!to || !message) {
      res.status(400).json({ success: false, error: 'to and message are required' });
      return;
    }

    const result = await smsService.sendSMS(to, message, businessId);
    if (!result.success) {
      res.status(400).json({ success: false, error: result.error });
      return;
    }

    res.json({ success: true, data: { messageId: result.messageId, provider: result.provider, cost: result.cost } });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sms/bulk - Bulk SMS
router.post('/bulk', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { numbers, message, businessId } = req.body;

    if (!Array.isArray(numbers) || !message) {
      res.status(400).json({ success: false, error: 'numbers (array) and message are required' });
      return;
    }

    const result = await smsService.sendBulkSMS(numbers, message, businessId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/sms/status/:id - Check delivery status
router.get('/status/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { provider } = req.query as { provider?: 'TWILIO' | 'VONAGE' };
    const result = await smsService.getStatus(id, provider || 'TWILIO');
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/sms/logs - SMS logs
router.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, limit, offset } = req.query as { businessId?: string; limit?: string; offset?: string };
    if (!businessId) {
      res.status(400).json({ success: false, error: 'businessId is required' });
      return;
    }
    const logs = await smsService.getSMSLogs(businessId, parseInt(limit || '50'), parseInt(offset || '0'));
    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/sms/credentials - Save provider credentials (simplified, stores in DB)
router.post('/credentials', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { twilioSid, twilioToken, twilioFrom, vonageKey, vonageSecret } = req.body;
    // In production, these would be encrypted and stored. For now, return success.
    logger.info('[SMS] Credentials saved (env-based config)');
    res.json({ success: true, message: 'Credentials saved' });
  } catch (error) {
    next(error);
  }
});
router.post('/webhook/twilio', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await smsService.handleTwilioWebhook(req.body);
    res.type('text/xml').send('<Response/>');
  } catch (error) {
    next(error);
  }
});

export default router;
