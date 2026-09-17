import { Router } from 'express';
import { createCheckoutSession, getCheckoutSession, completeCheckoutSession, createEmbedCheckoutSession, createPartnerEmbedCheckoutSession, initiateStripeCheckout, initiateCryptoCheckout, initiateEscrowCheckout, initiateCashAppCheckout, getCheckoutReceipt, createDemoCheckoutSession, getOnrampQuotes, createOnrampSession, initiatePayLioCheckout, paylioCallback } from '../controllers/checkout.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';
import { apiKeyAuth } from '../middleware/apiKey.middleware';

const router = Router();

// Partner embed checkout: accepts `x-api-key` without existing merchant session.
// Intended for embedded partner checkout calls from Shopify, live selling, freelance, hospitality widgets, etc.
router.post('/embed-checkout/public', apiKeyAuth, createPartnerEmbedCheckoutSession);

// Generic internal embed checkout path: currently requires active session.
router.post('/embed-checkout', createEmbedCheckoutSession);

// Create a new checkout session (protected, requires business context)
router.post('/session', authenticate, createCheckoutSession);
router.get('/session/:id', getCheckoutSession);
router.post('/session/:id/complete', completeCheckoutSession);
router.post('/embed-checkout', createEmbedCheckoutSession);
router.post('/embed-checkout/public', apiKeyAuth, createPartnerEmbedCheckoutSession);

router.post('/session/:id/stripe', optionalAuthenticate, initiateStripeCheckout);
router.post('/session/:id/cashapp', optionalAuthenticate, initiateCashAppCheckout);
router.post('/session/:id/crypto', optionalAuthenticate, initiateCryptoCheckout);
router.post('/session/:id/escrow', optionalAuthenticate, initiateEscrowCheckout);
router.post('/session/:id/paylio', optionalAuthenticate, initiatePayLioCheckout);
router.get('/session/:id/paylio/callback', paylioCallback);

// On-ramp quotes and sessions (fiat -> crypto)
router.get('/onramp/quotes', getOnrampQuotes);
router.post('/onramp/session', createOnrampSession);

// Deterministic ops/checkout receipt for buyer and seller views
router.get('/session/:id/receipt', getCheckoutReceipt);

// Public demo checkout session for CoCreate walkthroughs
router.post('/session/demo', createDemoCheckoutSession);

export default router;
