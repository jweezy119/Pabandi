import { Router } from 'express';
import { createCheckoutSession, getCheckoutSession, completeCheckoutSession, createEmbedCheckoutSession } from '../controllers/checkout.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Create a generic external-style checkout session without strict business ownership enforcement.
// Intended for embedded partner flows: Shopify, live selling, freelance, hospitality widgets, etc.
router.post('/embed-checkout', createEmbedCheckoutSession);

// Create a new checkout session (protected, requires business context)
router.post('/session', authenticate, createCheckoutSession);

// Get checkout session details for the buyer UI (public)
router.get('/session/:id', getCheckoutSession);

// Complete the checkout session (in a real app, this would be via Stripe/payment gateway webhook)
// For MVP/Demo, this is called by the frontend when buyer clicks pay
router.post('/session/:id/complete', completeCheckoutSession);

export default router;
