import { Router, Request, Response } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth.middleware';
import { processWhatsAppMessage, sendWhatsAppMessage } from '../services/ai.service';
import { logger } from '../utils/logger';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const evolutionConfigured = Boolean(
    process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE_ID
  );
  res.json({
    success: true,
    data: {
      provider: evolutionConfigured ? 'evolution' : 'unconfigured',
      evolutionConfigured,
      openwaConfigured: Boolean(process.env.OPENWA_API_KEY),
    },
  });
});

router.post('/webhook', async (req: Request, res: Response) => {
  const secret = process.env.OPENWA_WEBHOOK_SECRET || process.env.EVOLUTION_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.header('x-webhook-secret');
    if (provided !== secret) {
      res.status(401).json({ success: false, error: 'Invalid webhook secret' });
      return;
    }
  }

  const body = req.body || {};
  const event = String(body.event || '');
  const data = body.data || {};
  const from = String(data?.key?.remoteJid || data?.key?.from || '').replace(/\D/g, '');
  const fromMe = Boolean(data?.key?.fromMe);
  const text =
    data?.message?.conversation ||
    data?.message?.extendedTextMessage?.text ||
    data?.message?.text ||
    '';

  if (event === 'messages.upsert' && !fromMe && from && text) {
    try {
      await processWhatsAppMessage(
        from,
        process.env.WHATSAPP_BUSINESS_PHONE || '',
        String(text),
        null
      );
    } catch (error: any) {
      logger.error('[WhatsApp Webhook] Failed to process message:', error?.message || error);
    }
  }

  res.json({ success: true });
});

router.post('/send', authenticate, authorize('ADMIN', 'BUSINESS_OWNER'), async (req: AuthRequest, res: Response) => {
  try {
    const { phone, message } = req.body || {};
    if (!phone || !message) {
      res.status(400).json({ success: false, error: 'phone and message are required' });
      return;
    }
    const messageId = await sendWhatsAppMessage(String(phone), String(message));
    res.json({ success: true, data: { messageId: messageId || null } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
