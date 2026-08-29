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
import recommendationRoutes from './routes/recommendation.routes';
import disputeRoutes from './routes/dispute.routes';
import escrowRoutes from './routes/escrow.routes';
import loanRoutes from './routes/loan.routes';
import shopifyIntegrationRoutes from './routes/shopify-integration.routes';
import openwaRoutes from './routes/openwa.routes';
import openwaWebhookRoutes from './routes/openwa.webhook.routes';
import evolutionWebhookRoutes from './routes/evolution.webhook.routes';
import treasuryRoutes from './routes/treasury.routes';
import treasuryAutonomousRoutes from './routes/treasury.autonomous.routes';
import economyRoutes from './routes/economy.routes';
import marketingRoutes from './routes/marketing.routes';
import gigRoutes from './routes/gig.routes';
import loopRoutes from './routes/loop.routes';
import programRoutes from './routes/program.routes';
import rentalDepositRoutes from './routes/rentalDeposit.routes';
import ppdRoutes from './routes/ppd.routes';
import guaranteeClaimRoutes from './routes/guaranteeClaim.routes';
import appIntegrationRoutes from './routes/appIntegration.routes';
import agentMarketplaceRoutes from './routes/agentMarketplace.routes';
import { agentLearningRoutes } from './routes/agentLearning.routes';
import trustPassportRoutes from './routes/trustPassport.routes';
import payoutRoutes from './routes/payout.routes';
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
import backgroundCheckRoutes from './routes/backgroundCheck.routes';
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
app.use(`/api/${API_VERSION}/payouts`, payoutRoutes);
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
app.use(`/api/${API_VERSION}/background-check`, backgroundCheckRoutes);
app.use(`/api/${API_VERSION}/reviews`, pabandiReviewRoutes);

import aiRoutes from './routes/ai.routes';
app.use(`/api/${API_VERSION}/ai`, aiRoutes);

import bestFitRoutes from './routes/bestFit.routes';
app.use(`/api/${API_VERSION}/best-fit`, bestFitRoutes);

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
app.use(`/api/${API_VERSION}/recommendation`, recommendationRoutes);
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

import oauthRoutes from './routes/oauth.routes';
app.use(`/api/${API_VERSION}/oauth`, oauthRoutes);

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
app.use(`/api/${API_VERSION}/treasury`, treasuryAutonomousRoutes);
app.use(`/api/${API_VERSION}/economy`, economyRoutes);
app.use(`/api/${API_VERSION}/marketing`, marketingRoutes);
app.use(`/api/${API_VERSION}/gigs`, gigRoutes);
app.use(`/api/${API_VERSION}/loops`, loopRoutes);
app.use(`/api/${API_VERSION}/programs`, programRoutes);
app.use(`/api/${API_VERSION}/pyd`, rentalDepositRoutes);
app.use(`/api/${API_VERSION}/ppd`, ppdRoutes);
app.use(`/api/${API_VERSION}/guarantee`, guaranteeClaimRoutes);
app.use(`/api/${API_VERSION}/apps`, appIntegrationRoutes);
app.use(`/api/${API_VERSION}/agents`, agentMarketplaceRoutes);
app.use(`/api/${API_VERSION}/agents`, agentLearningRoutes);
app.use(`/api/${API_VERSION}/trust-passport`, trustPassportRoutes);

// ── OSINT Intelligence Layer (Threat Fusion, Adversarial Graph, Biometrics) ──
import osintRoutes from './routes/osint.routes';
app.use(`/api/${API_VERSION}/osint`, osintRoutes);

// ── PTP: Pabandi Trust Protocol (Seals, Billing, Discovery) ──────────────────
import sealRoutes from './routes/seal.routes';
import billingRoutes from './routes/billing.routes';
import wellknownRoutes from './routes/wellknown.routes';
import agentPassportRoutes from './routes/agentPassport.routes';
import realestateRoutes from './routes/realestate.routes';
import porRoutes from './routes/por.routes';
import predictiveRoutes from './routes/predictive.routes';
import geoRiskRoutes from './routes/geoRisk.routes';
import protocolV2Routes from './routes/protocolV2.routes';
import agentLoopRoutes from './routes/agentLoop.routes';
import { mcpHandler } from './mcp/pabandiMcpServer';
import jobsRoutes from './routes/jobs.routes';
import seedRoutes from './routes/seed.routes';

app.use(`/api/${API_VERSION}/seal`, sealRoutes);
app.use(`/api/${API_VERSION}/billing`, billingRoutes);
app.use(`/api/${API_VERSION}/jobs`, jobsRoutes);
app.use(`/api/${API_VERSION}/seed`, seedRoutes);
app.use('/.well-known/ptp', wellknownRoutes); // Note: standard .well-known structure
app.get('/.well-known/ptp.json', async (req, res) => {
  const { ptpEngine } = await import('./protocol/ptp.spec');
  const base = `${req.protocol}://${req.get('host')}`;
  res.json(ptpEngine.getDiscoveryDocument(base));
});
app.use(`/api/${API_VERSION}/agent-passport`, agentPassportRoutes); // AI-agent trust standard (issue/verify)
app.use(`/api/${API_VERSION}/realestate`, realestateRoutes); // ZK real-estate/hospitality escrow proofs
app.use(`/api/${API_VERSION}/por`, porRoutes); // ZK Proof of Rent (portable tenant reliability)
app.use(`/api/${API_VERSION}/predictive`, predictiveRoutes); // Predictive Intelligence (risk + demand + slots)
app.use(`/api/${API_VERSION}/geo`, geoRiskRoutes); // Geospatial Risk Oracle (property + dual-risk pricing)
app.use(`/api/${API_VERSION}/v2`, protocolV2Routes); // Pabandi Protocol v2.0: ZK / ACTUS / Kleros / Aragon / Mesh
app.use(`/api/${API_VERSION}/agent-loop`, agentLoopRoutes); // AI-agent booking loop control (live/sim)
app.post('/mcp', mcpHandler); // Model Context Protocol — Pabandi Agent Passport distribution layer
app.post(`/api/${API_VERSION}/mcp`, mcpHandler); // alias for path-prefixed clients

// Expose public SDK for trust seals
import path from 'path';
app.use('/sdk', express.static(path.join(__dirname, 'public')));

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
  // Shopify deep-link redirect (unchanged)
  if (req.query.shop && req.query.host) {
    const frontendUrl = 'https://pabandi-42c5b.web.app';
    return res.redirect(`${frontendUrl}/shopify/app?shop=${req.query.shop}&host=${req.query.host}`);
  }
  // Serve the React SPA to browsers; keep the JSON welcome for API clients (curl/health).
  if (req.headers.accept && String(req.headers.accept).includes('text/html')) {
    res.setHeader('Cache-Control', 'no-cache');
    return res.sendFile(path.join(__dirname, 'public', 'app', 'index.html'), (err: any) => {
      if (err) res.status(200).json({ success: true, message: 'Welcome to the Pabandi Backend API', version: API_VERSION, docs: `/api/${API_VERSION}/docs`, health: '/health' });
    });
  }
  res.status(200).json({
    success: true,
    message: 'Welcome to the Pabandi Backend API',
    version: API_VERSION,
    docs: `/api/${API_VERSION}/docs`,
    health: '/health',
  });
});

// ── React SPA hosting (embedded client build) ───────────────────────────────
// Serve the built React app from the same Render service so the whole product is live
// without a separate Firebase host. Registered BEFORE the 404 handler so client-side
// routes (/search, /login, /dashboard, ...) resolve to index.html.
const SPA_DIR = path.join(__dirname, 'public', 'app');
const SPA_INDEX = path.join(SPA_DIR, 'index.html');
// Serve built assets with long cache (hashed filenames), but force no-cache on the
// SPA shell (index.html) so Cloudflare/edge never serves a stale bundle after a deploy.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const p = req.path;
  if ((p === '/' || p === '/index.html') && req.method === 'GET') {
    res.setHeader('Cache-Control', 'no-cache');
  }
  next();
});
app.use(express.static(SPA_DIR));
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.method !== 'GET') return next();
  const p = req.path;
  if (p.startsWith('/api') || p.startsWith('/sdk') || p.startsWith('/health') || p.startsWith('/mcp')
    || p.startsWith('/well-known') || p.startsWith('/.well-known') || p.startsWith('/shopify')
    || p.startsWith('/assets') || p.startsWith('/images') || p === '/manifest.webmanifest'
    || p === '/robots.txt' || p === '/sitemap.xml' || p === '/llms.txt' || p.startsWith('/pab-')) {
    return next();
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(SPA_INDEX, (err: any) => { if (err) next(); });
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

  // Start Autonomous Marketing Agent (DRY_RUN by default; opt-in LIVE via SOCIAL_LIVE + MARKETING_AUTONOMOUS)
  try {
    const { startAutonomousMarketing } = await import('./services/marketingAgent.service');
    startAutonomousMarketing();
  } catch (err) {
    logger.warn(`Marketing agent skipped: ${(err as Error).message}`);
  }

  // Start SEGMENTED autonomous loops: project owners (post gigs) + freelancers (book+complete).
  // Opt-in via AUTONOMOUS_LOOPS=true (off by default so nothing surprises you).
  try {
    const { startLoops } = await import('./services/loop.service');
    startLoops();
    logger.info('🔁 Segmented loops registered (project-owners + freelancers)');
  } catch (err) {
    logger.warn(`Loops skipped: ${(err as Error).message}`);
  }

  // ── LIVE RAIL SELF-CHECK (fails LOUD, not silent) ───────────────────────────
  if (process.env.LIVE_BOOKINGS === 'true') {
    if (!process.env.SOLANA_PRIVATE_KEY) {
      logger.error('🚨 LIVE_BOOKINGS=true but SOLANA_PRIVATE_KEY is MISSING — the loop will run in SIMULATED mode (no real on-chain transfers). Add SOLANA_PRIVATE_KEY to Render and restart to go live.');
    } else {
      logger.info('✅ LIVE_BOOKINGS=true and SOLANA_PRIVATE_KEY present — live on-chain rail armed. Run POST /api/v1/agent-loop/prepare-live once the wallet is funded.');
    }
    if (!process.env.TREASURY_WALLET || process.env.TREASURY_WALLET.startsWith('PABANDi')) {
      logger.error('🚨 TREASURY_WALLET is not set / is a placeholder — agent SOL fees would route to a non-real address.');
    }
    if (!process.env.FEE_TREASURY_WALLET || process.env.FEE_TREASURY_WALLET.startsWith('PABANDi')) {
      logger.error('🚨 FEE_TREASURY_WALLET is not set — human SOL fees route to placeholder. Set FEE_TREASURY_WALLET.');
    }
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

// USDY rail rebuild trigger 1788029916

// USDY landing rebuild trigger 1788031112

// USDY landing + admin delete rebuild trigger 1788031568

// USDY wiring + share rebuild trigger 1788032332

// homepage USDY strip rebuild trigger 1788032843

// SPA fix rebuild trigger 1788034008

// search/discovery UX rebuild trigger 1788035262

// booking flow polish rebuild trigger 1788036137
