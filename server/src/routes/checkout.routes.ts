import { Router } from 'express';
import { createCheckoutSession, getCheckoutSession, completeCheckoutSession, createEmbedCheckoutSession, createPartnerEmbedCheckoutSession, initiateStripeCheckout, initiateCryptoCheckout, initiateEscrowCheckout } from '../controllers/checkout.controller';
import { authenticate } from '../middleware/auth.middleware';
import { apiKeyAuth } from '../middleware/apiKey.middleware';

const router = Router();

// Partner embed checkout: accepts `x-api-key` without existing merchant session.
// Intended for embedded partner checkout calls from Shopify, live selling, freelance, hospitality widgets, etc.
router.post('/embed-checkout/public', apiKeyAuth, createPartnerEmbedCheckoutSession);

// Generic internal embed checkout path: currently requires active session.
router.post('/embed-checkout', createEmbedCheckoutSession);

// Create a new checkout session (protected, requires business context)
router.post('/session', authenticate, createCheckoutSession);

// Get checkout session details for the buyer UI (public)
router.get('/session/:id', getCheckoutSession);

// Complete the checkout session (in a real app, this would be via Stripe/payment gateway webhook)
// For MVP/Demo, this is called by the frontend when buyer clicks pay
router.post('/session/:id/complete', completeCheckoutSession);

// Initiate Stripe Checkout session
router.post('/session/:id/stripe', initiateStripeCheckout);

// Initiate deterministic crypto checkout session payload
router.post('/session/:id/crypto', initiateCryptoCheckout);

// Initiate escrow checkout session
router.post('/session/:id/escrow', initiateEscrowCheckout);

export default router;
