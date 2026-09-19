import { Router } from 'express';
import { createSquareCheckout, getSquarePayment, handleSquareWebhook, createSquareRefund } from '../controllers/squareCheckout.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Webhook endpoint — NO auth (Square calls this externally)
router.post('/webhook', handleSquareWebhook);

// Protected routes (require auth)
router.post('/checkout', authenticate, createSquareCheckout);
router.get('/payment/:paymentId', authenticate, getSquarePayment);
router.post('/refund', authenticate, createSquareRefund);

export default router;
