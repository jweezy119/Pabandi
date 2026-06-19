import { Router } from 'express';
import { handleIncomingWhatsApp, verifyWebhook } from '../controllers/whatsapp.controller';

const router = Router();

// Meta Webhook Verification
router.get('/webhook', verifyWebhook);

// Incoming WhatsApp messages
router.post('/webhook', handleIncomingWhatsApp);

export default router;
