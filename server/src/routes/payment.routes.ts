import { Router } from 'express';
import { createPayment, getPayment, processPaymentWebhook, createSubscriptionCheckout } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/webhook', processPaymentWebhook); // No auth - webhook endpoint
if (process.env.NODE_ENV !== 'production') {
  router.post('/simulate-webhook', processPaymentWebhook); // Dev/test endpoint only
}
router.use(authenticate);
router.post('/', createPayment);
router.get('/:id', getPayment);
router.post('/subscription-checkout', createSubscriptionCheckout);

export default router;
