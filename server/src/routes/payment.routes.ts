import { Router } from 'express';
import express from 'express';
import { createPayment, getPayment, processPaymentWebhook, createSubscriptionCheckout } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { isDemoMode } from '../utils/env';

const router = Router();

router.post('/webhook', express.raw({ type: 'application/json', verify: (req: any, _res, buf) => { req.rawBody = buf; } }), processPaymentWebhook);
if (isDemoMode()) {
  router.post('/simulate-webhook', express.raw({ type: 'application/json', verify: (req: any, _res, buf) => { req.rawBody = buf; } }), processPaymentWebhook);
}
router.use(authenticate);
router.post('/', createPayment);
router.get('/:id', getPayment);
router.post('/subscription-checkout', createSubscriptionCheckout);

export default router;
