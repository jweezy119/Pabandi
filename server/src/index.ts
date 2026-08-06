// Pabandi Server - IPv4 Pooler active
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import passport from 'passport';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { auditLog } from './middleware/audit.middleware';
import { configurePassport } from './utils/passport';
import { startDbKeepalive } from './utils/dbKeepalive';
import { initFirebaseAdmin } from './utils/firebase';
import { requireAppCheck } from './middleware/appCheck.middleware';

// Load environment variables FIRST
dotenv.config();
try { dotenv.config({ path: '.env.contracts' }); } catch (err) { logger.warn('.env.contracts not loaded'); }

import { setupSwagger } from './utils/swagger';


// Import routes
import authRoutes from './routes/auth.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import whatsappAdvancedRoutes from './routes/whatsapp.advanced.routes';
import businessRoutes from './routes/business.routes';
import reservationRoutes from './routes/reservation.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminRoutes from './routes/admin.routes';
import webhookRoutes from './routes/webhook.routes';
import cryptoRoutes from './routes/crypto.routes';
import externalRoutes from './routes/external.routes';
import apiClientsRoutes from './routes/apiClients.routes';
import apiKeyRoutes from './routes/apiKey.routes';
import socialRoutes from './routes/social.routes';
import checkoutRoutes from './routes/checkout.routes';
import walletRoutes from './routes/wallet.routes';
import waitlistRoutes from './routes/waitlist.routes';
import hospitalityRoutes from './routes/hospitality.routes';
import trustRoutes from './routes/trust.routes';
import pabandiReviewRoutes from './routes/pabandiReview.routes';
import disputeRoutes from './routes/dispute.routes';
import escrowRoutes from './routes/escrow.routes';
import loanRoutes from './routes/loan.routes';
import shopifyIntegrationRoutes from './routes/shopify-integration.routes';
import openwaRoutes from './routes/openwa.routes';
import openwaWebhookRoutes from './routes/openwa.webhook.routes';
import evolutionWebhookRoutes from './routes/evolution.webhook.routes';
import treasuryRoutes from './routes/treasury.routes';
import accountManagerRoutes from './routes/accountManager.routes';
import offrampRoutes from './routes/offramp.routes';
import offrampWebhookRoutes from './routes/offramp-webhook.routes';
import webhookStripeRoutes from './routes/webhook.stripe.routes';
import webhookEscrowRoutes from './routes/webhook.escrow.routes';
import didRoutes from './routes/did.routes';
import vcRoutes from './routes/vc.routes';
import ebayRoutes from './routes/ebay.routes';
import monetizationRoutes from './routes/monetization.routes';
import linkedinRoutes from './routes/linkedin.routes';
import linkedinSeedRoutes from './routes/linkedinSeed.routes';
import { startAgentLoop } from './services/agentLoop.service';

const app = express();
const httpServer = createServer(app);

// Initialize Firebase Admin globally
try { initFirebaseAdmin(); } catch (err) { logger.warn('Firebase init skipped: ' + (err as Error).message); }

// Configure Passport strategies (env vars loaded above)
try { configurePassport(); } catch (err) { logger.warn('Passport init skipped: ' + (err as Error).message); }
app.use(passport.initialize());

// Start DB keepalive to prevent Supabase free-tier pause
try { startDbKeepalive(); } catch (err) { logger.warn('DB keepalive skipped: ' + (err as Error).message); }

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 5000);
const API_VERSION = process.env.API_VERSION || 'v1';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

if (DEMO_MODE) {
  logger.warn('DEMO_MODE enabled');  
}

// Security and Performance middleware
app.set('trust proxy', 1); // Essential for rate limiting behind Cloud Run
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      frameAncestors: ["'self'", "https://*.myshopify.com", "https://admin.shopify.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  frameguard: false, // Must be disabled so we don't send X-Frame-Options: SAMEORIGIN
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}));
app.use(compression());
const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/app\/?$/, '');
app.use(cors({
  origin: [frontendOrigin, 'http://localhost:3000', 'http://localhost:5500', 'https://pabandi-42c5b.web.app', 'https://pabandi.com', 'https://www.pabandi.com'].filter(
    (v, i, a) => v && a.indexOf(v) === i
  ),
  credentials: true,
}));

// Body parsing middleware — capture raw body for webhook HMAC verification
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Rate limiting
app.use('/api/', rateLimiter);

// Audit logging (runs for all routes starting with /api/)
app.use('/api/', auditLog);

// Firebase App Check Middleware for API routes
app.use('/api/', requireAppCheck);

// Health check endpoints
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
  });
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/businesses`, businessRoutes);
app.use(`/api/${API_VERSION}/reservations`, reservationRoutes);
app.use(`/api/${API_VERSION}/disputes`, disputeRoutes);
app.use(`/api/${API_VERSION}/loans`, loanRoutes);
app.use(`/api/${API_VERSION}/payments`, paymentRoutes);
import paymentReconciliationRoutes from './routes/payment-reconciliation.routes';
app.use(`/api/${API_VERSION}/payments`, paymentReconciliationRoutes);
app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);
app.use(`/api/${API_VERSION}/shopify-integration`, shopifyIntegrationRoutes);
app.use(`/api/${API_VERSION}/webhooks`, webhookRoutes);
app.use(`/api/${API_VERSION}/checkout`, checkoutRoutes);
app.use(`/api/${API_VERSION}/escrow`, escrowRoutes);
app.use(`/api/${API_VERSION}/crypto`, cryptoRoutes);
// app.use(`/api/${API_VERSION}/badges`, badgeRoutes);
app.use(`/api/${API_VERSION}/whatsapp`, whatsappRoutes);
app.use(`/api/${API_VERSION}/whatsapp/advanced`, whatsappAdvancedRoutes);
app.use(`/api/${API_VERSION}/admin/api-clients`, apiClientsRoutes);
app.use(`/api/${API_VERSION}/api-keys`, apiKeyRoutes);
app.use(`/api/${API_VERSION}/trust`, trustRoutes);
app.use(`/api/${API_VERSION}/monetization`, monetizationRoutes);
app.use(`/api/${API_VERSION}/linkedin/seed`, linkedinSeedRoutes);
app.use(`/api/${API_VERSION}/linkedin`, linkedinRoutes);
app.use(`/api/${API_VERSION}/reviews`, pabandiReviewRoutes);

import aiRoutes from './routes/ai.routes';
app.use(`/api/${API_VERSION}/ai`, aiRoutes);

import web3Routes from './routes/web3.routes';
app.use(`/api/${API_VERSION}/web3`, web3Routes);

import apiPublicRoutes from './routes/api-public.routes';
app.use(`/api/${API_VERSION}/public`, apiPublicRoutes);

import apiSubscriptionRoutes from './routes/api-subscription.routes';
app.use(`/api/${API_VERSION}/api-subscription`, apiSubscriptionRoutes);

import reliabilityRoutes from './routes/reliability.routes';

import stakingRoutes from './routes/staking.routes';
import airdropRoutes from './routes/airdrop.routes';

import sourcingRoutes from './routes/sourcing.routes';

app.use(`/api/${API_VERSION}/social`, socialRoutes);
app.use(`/api/${API_VERSION}/wallet`, walletRoutes);
app.use(`/api/${API_VERSION}/reliability`, reliabilityRoutes);
app.use(`/api/${API_VERSION}/token-staking`, stakingRoutes);
app.use(`/api/${API_VERSION}/airdrop`, airdropRoutes);
app.use(`/api/${API_VERSION}/sourcing`, sourcingRoutes);
app.use(`/api/${API_VERSION}/waitlist`, waitlistRoutes);
app.use(`/api/${API_VERSION}/account-manager`, accountManagerRoutes);
app.use(`/api/${API_VERSION}/offramp`, offrampRoutes);
app.use(`/api/${API_VERSION}/offramp/webhook`, offrampWebhookRoutes);
app.use('/.well-known', didRoutes);
app.use('/api/v1/live-seller/ebay', ebayRoutes);
app.use(`/api/${API_VERSION}/webhook/stripe`, webhookStripeRoutes);
app.use(`/api/${API_VERSION}/webhook/escrow`, webhookEscrowRoutes);

// W3C Verifiable Credentials (OBv3)
app.use(`/api/${API_VERSION}/passport/vc`, vcRoutes);

import tapRoutes from './routes/tap.routes';
app.use(`/api/${API_VERSION}/tap`, tapRoutes);

app.use(`/api/${API_VERSION}/hospitality`, hospitalityRoutes);
app.use('/api/hospitality', hospitalityRoutes); // Short alias for PMS webhooks

// ── Pabandi Intelligence API (B2B) ──────────────────────────────────────────
// Separate from /api/v1/ so it can be independently rate-limited and versioned
app.use('/external/v1', externalRoutes);

// ── Public Passport summary (no auth) ─────────────────────────────────────
import publicPassportRoutes from './routes/publicPassport.routes';
app.use(`/api/${API_VERSION}/passport/public`, publicPassportRoutes);

import textSearchRoutes from './routes/textSearch.routes';
app.use(`/api/${API_VERSION}/text-search`, textSearchRoutes);

// ── Pabandi Reliability Passport API (Public, API-key gated) ─────────────────
import passportRoutes from './routes/passport.routes';
app.use(`/api/${API_VERSION}/passport`, passportRoutes);

// ── Proof-of-Presence API ──────────────────────────────────────────
import popRoutes from './routes/pop.routes';
app.use(`/api/${API_VERSION}/pop`, popRoutes);

// ── Zero-Knowledge Network API (Shopify/E-Commerce Plugins) ──────────────────
import networkRoutes from './routes/network.routes';
app.use(`/api/${API_VERSION}/network`, networkRoutes);

import userRoutes from './routes/user.routes';
app.use(`/api/${API_VERSION}/users`, userRoutes);

// ── Omni-Channel Integrations API (TikTok Shop Webhooks, etc) ────────────────
import integrationsRoutes from './routes/integrations.routes';
import liveSellRoutes from './routes/livesell.routes';
import shopifyRoutes from './routes/shopify.routes';
app.use(`/api/${API_VERSION}/integrations`, integrationsRoutes);
app.use(`/api/${API_VERSION}/integrations/livesell`, liveSellRoutes);
app.use(`/api/${API_VERSION}/shopify`, shopifyRoutes);
app.use(`/api/${API_VERSION}/openwa`, openwaRoutes);
app.use(`/api/${API_VERSION}/openwa/webhook`, openwaWebhookRoutes);
app.use(`/api/${API_VERSION}/evolution`, evolutionWebhookRoutes);
app.use(`/api/${API_VERSION}/treasury`, treasuryRoutes);

// ── Public Badge Verification (no auth needed) ───────────────────────────────
app.get(`/api/${API_VERSION}/badge/:pseudonymousId`, async (req, res) => {
  try {
    const { badgeService } = await import('./services/badge.service');
    const userId = await badgeService.resolveUserFromPseudonymousId(req.params.pseudonymousId);
    if (!userId) {
      return res.status(404).json({ success: false, error: 'Badge not found' });
    }
    const badge = await badgeService.computeBadgeStatus(userId);
    return res.json({ success: true, data: badge });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Setup Swagger UI and Docs
setupSwagger(app);

// API Documentation
app.get(`/api/${API_VERSION}/docs`, (_req, res) => {
  res.redirect('/api/docs');
});

// Root route
app.get('/', (req, res) => {
  // If request comes from Shopify Admin (has shop and host), redirect to frontend embedded app
  if (req.query.shop && req.query.host) {
    // We explicitly route to the production frontend because the Shopify Admin 
    // is accessing this from the merchant's browser over the internet.
    const frontendUrl = 'https://pabandi-42c5b.web.app';
    return res.redirect(`${frontendUrl}/shopify/app?shop=${req.query.shop}&host=${req.query.host}`);
  }

  res.status(200).json({
    success: true,
    message: 'Welcome to the Pabandi Backend API',
    version: API_VERSION,
    docs: `/api/${API_VERSION}/docs`,
    health: '/health',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const parsedPort = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
httpServer.listen(parsedPort, '0.0.0.0', async () => {
  logger.info(`🚀 Server running on port ${parsedPort}`);
  logger.info(`📚 API available at http://localhost:${parsedPort}/api/${API_VERSION}`);
  logger.info(`🏥 Health check: http://localhost:${parsedPort}/health`);
  logger.info(`🔑 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅ configured' : '❌ not configured'}`);

  // Start OpenWA webhook manager (registers handlers and webhook with OpenWA)
  try {
    const { registerWebhookHandlers } = await import('./services/openwa.webhook-handler.service');
    const { webhookManager } = await import('./services/openwa.webhook-manager.service');
    registerWebhookHandlers();
    webhookManager.start().catch(err => logger.warn(`OpenWA webhook manager start deferred: ${err?.message}`));
    logger.info('📡 OpenWA webhook manager initialized');
  } catch (err) {
    logger.warn(`OpenWA webhook manager skipped: ${(err as Error).message}`);
  }

  // Start Telegram LP Bot
  try {
    const { startTelegramBot } = await import('./services/telegram-bot.service');
    startTelegramBot();
  } catch (err) {
    logger.warn(`Telegram bot skipped: ${(err as Error).message}`);
  }

  // Start Agent Loop (badge purchases → bookings → pool fee collection)
  try {
    startAgentLoop();
    logger.info('🤖 AI Agent Loop started');
  } catch (err) {
    logger.warn(`Agent loop skipped: ${(err as Error).message}`);
  }

  // Start Phase 0 Offramp SLA Sweeper
  setInterval(() => {
    import('./services/offramp.service').then(({ offrampService }) => {
      offrampService.expireStaleIntents().catch(err => {
        logger.error(`[Offramp Sweeper Error] ${err.message}`);
      });
    });
  }, 5000);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  try {
    const { webhookManager } = await import('./services/openwa.webhook-manager.service');
    await webhookManager.stop();
  } catch { /* ignore */ }
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;