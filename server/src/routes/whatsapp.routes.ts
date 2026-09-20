import { Router, Request, Response, NextFunction } from 'express';
import { pabandiWhatsAppService } from '../services/pabandiWhatsApp.service';
import { whatsAppBotService } from '../services/whatsappBot.service';
import { logger } from '../utils/logger';

const router = Router();

// =============================================
// Send message
// POST /api/v1/whatsapp/send
// =============================================
router.post('/send', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to, message, type = 'text' } = req.body || {};
    
    if (!to || !message) {
      return res.status(400).json({ success: false, error: 'to and message are required' });
    }

    let result;
    if (type === 'interactive') {
      result = await pabandiWhatsAppService.sendInteractiveMessage(to, message, req.body.buttons || []);
    } else {
      result = await pabandiWhatsAppService.sendMessage(to, message);
    }

    res.json({ success: result.success, messageId: result.messageId });
  } catch (error: any) {
    logger.error(`[WhatsApp Routes] Send error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Booking confirmation
// POST /api/v1/whatsapp/booking/:id/confirm
// =============================================
router.post('/booking/:id/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { phone } = req.body || {};
    
    // Find booking (placeholder - will be enhanced)
    const bookingDetails = {
      id,
      businessName: req.body.businessName || 'Restaurant Name',
      customerName: req.body.customerName || 'Customer',
      date: req.body.date || new Date().toISOString().split('T')[0],
      time: req.body.time || '19:00',
      partySize: req.body.partySize || 2,
      status: 'CONFIRMED',
      totalAmount: req.body.totalAmount || 5000,
    };

    if (!phone) {
      return res.status(400).json({ success: false, error: 'phone is required' });
    }

    const result = await pabandiWhatsAppService.sendBookingConfirmation(phone, bookingDetails);
    res.json({ success: result.success, messageId: result.messageId });
  } catch (error: any) {
    logger.error(`[WhatsApp Routes] Booking confirm error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Payment reminder
// POST /api/v1/whatsapp/installment/:id/remind
// =============================================
router.post('/installment/:id/remind', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { phone } = req.body || {};
    
    const installmentDetails = {
      id,
      businessName: req.body.businessName || 'Business',
      amount: req.body.amount || 10000,
      dueDate: req.body.dueDate || new Date().toISOString().split('T')[0],
      status: req.body.status || 'PENDING',
      installmentNumber: req.body.installmentNumber || 1,
      totalInstallments: req.body.totalInstallments || 12,
    };

    if (!phone) {
      return res.status(400).json({ success: false, error: 'phone is required' });
    }

    const result = await pabandiWhatsAppService.sendPaymentReminder(phone, installmentDetails);
    res.json({ success: result.success, messageId: result.messageId });
  } catch (error: any) {
    logger.error(`[WhatsApp Routes] Installment remind error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Escrow update
// POST /api/v1/whatsapp/escrow/:id/update
// =============================================
router.post('/escrow/:id/update', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { phone } = req.body || {};
    
    const escrowDetails = {
      id,
      businessName: req.body.businessName || 'Business',
      amount: req.body.amount || 50000,
      status: req.body.status || 'FUNDED',
      releaseDate: req.body.releaseDate,
    };

    if (!phone) {
      return res.status(400).json({ success: false, error: 'phone is required' });
    }

    const result = await pabandiWhatsAppService.sendEscrowUpdate(phone, escrowDetails);
    res.json({ success: result.success, messageId: result.messageId });
  } catch (error: any) {
    logger.error(`[WhatsApp Routes] Escrow update error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Webhook - Incoming messages
// POST /api/v1/whatsapp/webhook
// =============================================
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body;
    
    if (!body.object || !body.entry) {
      return res.status(400).json({ error: 'Invalid webhook payload' });
    }

    // Process the incoming message
    await pabandiWhatsAppService.handleIncomingMessage(body);
    
    // Send 200 OK immediately
    res.status(200).send('OK');
  } catch (error: any) {
    logger.error(`[WhatsApp Routes] Webhook error: ${error.message}`);
    // Still send 200 to prevent retry loops
    res.status(200).send('OK');
  }
});

// =============================================
// Webhook verification (Meta format)
// GET /api/v1/whatsapp/webhook
// =============================================
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.META_WA_VERIFY_TOKEN) {
      logger.info('[WhatsApp] Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// =============================================
// Message history
// GET /api/v1/whatsapp/history/:userId
// =============================================
router.get('/history/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    
    // Using prisma directly for now - WhatsAppMessage model not yet in Prisma client
    res.json({ success: true, data: [] });
  } catch (error: any) {
    logger.error(`[WhatsApp Routes] History error: ${error.message}`);
    next(error);
  }
});

// =============================================
// Bot command endpoint
// POST /api/v1/whatsapp/bot
// =============================================
router.post('/bot', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, message } = req.body || {};
    
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'phone and message are required' });
    }

    const response = await whatsAppBotService.processMessage(phone, message);
    res.json(response);
  } catch (error: any) {
    logger.error(`[WhatsApp Routes] Bot error: ${error.message}`);
    next(error);
  }
});

export default router;
