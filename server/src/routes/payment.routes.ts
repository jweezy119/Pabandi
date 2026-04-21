import { Router } from 'express';
import { createPayment, getPayment, processPaymentWebhook } from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/webhook', processPaymentWebhook); // No auth - webhook endpoint
router.post('/simulate-webhook', processPaymentWebhook); // Mock frontend test endpoint
router.use(authenticate);
router.post('/', createPayment);
router.get('/:id', getPayment);

export default router;
