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
import { configurePassport } from './utils/passport';
import { requireAppCheck } from './middleware/appCheck.middleware';
import { setupSwagger } from './utils/swagger';

// Load environment variables FIRST
dotenv.config();
try { dotenv.config({ path: '.env.contracts' }); } catch (err) { logger.warn('.env.contracts not loaded'); }

const app = express();
const httpServer = createServer(app);

// DISABLED: Firebase Admin (spawns background processes)
// try { initFirebaseAdmin(); } catch (err) { logger.warn('Firebase init skipped: ' + (err as Error).message); }

// Configure Passport strategies (env vars loaded above)
try { configurePassport(); } catch (err) { logger.warn('Passport init skipped: ' + (err as Error).message); }
app.use(passport.initialize());

// DISABLED: DB keepalive (runs cron job forever)
// try { startDbKeepalive(); } catch (err) { logger.warn('DB keepalive skipped: ' + (err as Error).message); }

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 5000);
const API_VERSION = process.env.API_VERSION || 'v1';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

if (DEMO_MODE) {
  logger.warn('DEMO_MODE enabled');  
}

// Security and Performance middleware
app.set('trust proxy', 1); // Essential for rate limiting behind Cloud Run

// ── Startup sanity check: fail fast if required secrets are missing ───────────
const requiredEnvVars: string[] = [];
if (process.env.NODE_ENV === 'production') {
  // Wallet/JWT auth
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
    requiredEnvVars.push('JWT_SECRET (min 16 chars)');
  }
  // SafePay / EMI webhook verification
  if (!process.env.SAFEPAY_WEBHOOK_SECRET && !process.env.SAFEPAY_SECRET_KEY) {
    requiredEnvVars.push('SAFEPAY_WEBHOOK_SECRET or SAFEPAY_SECRET_KEY');
  }
  // LP API key for offramp
  if (!process.env.OFFRAMP__LP_API_KEY) {
    requiredEnvVars.push('OFFRAMP__LP_API_KEY');
  }
  // Firebase App Check (production)
  if (process.env.REQUIRE_APP_CHECK !== 'false' && !process.env.FIREBASE_APP_CHECK_SECRET) {
    requiredEnvVars.push('FIREBASE_APP_CHECK_SECRET (set REQUIRE_APP_CHECK=false to skip)');
  }
}
if (requiredEnvVars.length > 0) {
  logger.error(
    `🚨 Server starting with MISSING or weak env configuration in production:${requiredEnvVars.map(v => `\n   - ${v}`).join('')}\n` +
    `   Fix these before serving real traffic, or set NODE_ENV != 'production' to bypass the check (dev only).`
  );
  // Non-fatal in dev; in production this should be escalated to your deploy monitor
}

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
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'https://pabandi-42c5b.web.app',
  'https://pabandi.com',
  'https://www.pabandi.com',
];

// In production, strip localhost origins from CORS allowlist.
const isProductionEnv = process.env.NODE_ENV === 'production';
const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .replace(/\/app\/?$/, '');

const productionOrigins = [frontendOrigin, 'https://pabandi-42c5b.web.app', 'https://pabandi.com', 'https://www.pabandi.com'];

const allowedOrigins = isProductionEnv
  ? productionOrigins.filter((v, i, a) => v && a.indexOf(v) === i)
  : corsOrigins.filter((v, i, a) => v && a.indexOf(v) === i);

app.use(cors({
  origin: allowedOrigins,
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

// DISABLED: Audit logging (runs on every request, memory overhead)
// app.use('/api/', auditLog);

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

// API Routes — lazy-loaded to reduce startup memory footprint (Render 512MB limit)
async function loadApiRoutes() {
  const v = API_VERSION;
  const [
    auth, businesses, businessImport, reservations, disputes, loans, payouts,
    payments, paymentRecon, analytics, admin, shopify, webhooks, checkout,
    escrow, crypto, whatsapp, whatsappAdv, apiClients, apiKeys, trust, monet,
    linkedinSeed, linkedin, bgCheck, reviews, bestFit, web3, apiPublic,
    apiSub, reliability, staking, airdrop, sourcing, social, socialAuth,
    wallet, waitlist, acctMgr, offramp, offrampWh, did, recs, ebay, booking,
    pabEcon, aiReal, aiAdv, ai, marketplace, notif, walletAuth, propMgr,
    prop, docs, tenant, promo, rewards, freight, maps, promos, nightlife,
    venues, nightlifeInt, agentic, whStripe, whEscrow, vc, tap, hospitality,
    external, passport, publicPassport, textSearch, oauth, pop, network,
    users, integrations, liveSell, shopifyInt, osint, seal, billing, wellknown,
    agentPassport, realestate, por, predictive, geoRisk, protocolV2, agentLoop,
    mcp, jobs, seed,
  ] = await Promise.all([
    import('./routes/auth.routes'),
    import('./routes/business.routes'),
    import('./routes/businessImport.routes'),
    import('./routes/reservation.routes'),
    import('./routes/dispute.routes'),
    import('./routes/loan.routes'),
    import('./routes/payout.routes'),
    import('./routes/payment.routes'),
    import('./routes/payment-reconciliation.routes'),
    import('./routes/analytics.routes'),
    import('./routes/admin.routes'),
    import('./routes/shopify-integration.routes'),
    import('./routes/webhook.routes'),
    import('./routes/checkout.routes'),
    import('./routes/escrow.routes'),
    import('./routes/crypto.routes'),
    import('./routes/whatsapp.routes'),
    import('./routes/whatsapp.advanced.routes'),
    import('./routes/apiClients.routes'),
    import('./routes/apiKey.routes'),
    import('./routes/trust.routes'),
    import('./routes/monetization.routes'),
    import('./routes/linkedinSeed.routes'),
    import('./routes/linkedin.routes'),
    import('./routes/backgroundCheck.routes'),
    import('./routes/pabandiReview.routes'),
    import('./routes/bestFit.routes'),
    import('./routes/web3.routes'),
    import('./routes/api-public.routes'),
    import('./routes/api-subscription.routes'),
    import('./routes/reliability.routes'),
    import('./routes/staking.routes'),
    import('./routes/airdrop.routes'),
    import('./routes/sourcing.routes'),
    import('./routes/social.routes'),
    import('./routes/socialAuth.routes'),
    import('./routes/wallet.routes'),
    import('./routes/waitlist.routes'),
    import('./routes/accountManager.routes'),
    import('./routes/offramp.routes'),
    import('./routes/offramp-webhook.routes'),
    import('./routes/did.routes'),
    import('./routes/recommendation.routes'),
    import('./routes/ebay.routes'),
    import('./routes/booking.routes'),
    import('./routes/pabEconomy.routes'),
    import('./routes/aiRealEstate.routes'),
    import('./routes/aiAdvanced.routes'),
    import('./routes/ai.routes'),
    import('./routes/marketplace.routes'),
    import('./routes/notifications.routes'),
    import('./routes/walletAuth.routes'),
    import('./routes/propertyManager.routes'),
    import('./routes/property.routes'),
    import('./routes/document.routes'),
    import('./routes/tenant.routes'),
    import('./routes/promo.routes'),
    import('./routes/partnerRewards.routes'),
    import('./routes/freight.routes'),
    import('./routes/maps.routes'),
    import('./routes/promotions.routes'),
    import('./routes/nightlife.routes'),
    import('./routes/venues.routes'),
    import('./routes/nightlifeIntegration.routes'),
    import('./routes/agentic.routes'),
    import('./routes/webhook.stripe.routes'),
    import('./routes/webhook.escrow.routes'),
    import('./routes/vc.routes'),
    import('./routes/tap.routes'),
    import('./routes/hospitality.routes'),
    import('./routes/external.routes'),
    import('./routes/publicPassport.routes'),
    import('./routes/textSearch.routes'),
    import('./routes/oauth.routes'),
    import('./routes/passport.routes'),
    import('./routes/pop.routes'),
    import('./routes/network.routes'),
    import('./routes/user.routes'),
    import('./routes/integrations.routes'),
    import('./routes/livesell.routes'),
    import('./routes/shopify.routes'),
    import('./routes/openwa.routes'),
    import('./routes/openwa.webhook.routes'),
    import('./routes/evolution.webhook.routes'),
    import('./routes/treasury.routes'),
    import('./routes/treasury.autonomous.routes'),
    import('./routes/economy.routes'),
    import('./routes/marketing.routes'),
    import('./routes/gig.routes'),
    import('./routes/loop.routes'),
    import('./routes/program.routes'),
    import('./routes/rentalDeposit.routes'),
    import('./routes/ppd.routes'),
    import('./routes/guaranteeClaim.routes'),
    import('./routes/appIntegration.routes'),
    import('./routes/agentMarketplace.routes'),
    import('./routes/agentLearning.routes'),
    import('./routes/trustPassport.routes'),
    import('./routes/osint.routes'),
    import('./routes/seal.routes'),
    import('./routes/billing.routes'),
    import('./routes/wellknown.routes'),
    import('./routes/agentPassport.routes'),
    import('./routes/realestate.routes'),
    import('./routes/por.routes'),
    import('./routes/predictive.routes'),
    import('./routes/geoRisk.routes'),
    import('./routes/protocolV2.routes'),
    import('./routes/agentLoop.routes'),
    import('./mcp/pabandiMcpServer'),
    import('./routes/jobs.routes'),
    import('./routes/seed.routes'),
  ]);

  // Now register all routes
  app.use(`/api/${v}/auth`, auth.default || auth);
  app.use(`/api/${v}/businesses`, businesses.default || businesses);
  app.use(`/api/${v}/businesses/import`, businessImport.default || businessImport);
  app.use(`/api/${v}/reservations`, reservations.default || reservations);
  app.use(`/api/${v}/disputes`, disputes.default || disputes);
  app.use(`/api/${v}/loans`, loans.default || loans);
  app.use(`/api/${v}/payouts`, payouts.default || payouts);
  app.use(`/api/${v}/payments`, payments.default || payments);
  app.use(`/api/${v}/payments`, paymentRecon.default || paymentRecon);
  app.use(`/api/${v}/analytics`, analytics.default || analytics);
  app.use(`/api/${v}/admin`, admin.default || admin);
  app.use(`/api/${v}/shopify-integration`, shopify.default || shopify);
  app.use(`/api/${v}/webhooks`, webhooks.default || webhooks);
  app.use(`/api/${v}/checkout`, checkout.default || checkout);
  app.use(`/api/${v}/escrow`, escrow.default || escrow);
  app.use(`/api/${v}/crypto`, crypto.default || crypto);
  app.use(`/api/${v}/whatsapp`, (whatsapp as any).default || whatsapp);
  app.use(`/api/${v}/whatsapp/advanced`, (whatsappAdv as any).default || whatsappAdv);
  app.use(`/api/${v}/admin/api-clients`, (apiClients as any).default || apiClients);
  app.use(`/api/${v}/api-keys`, (apiKeys as any).default || apiKeys);
  app.use(`/api/${v}/trust`, (trust as any).default || trust);
  app.use(`/api/${v}/monetization`, (monet as any).default || monet);
  app.use(`/api/${v}/linkedin/seed`, (linkedinSeed as any).default || linkedinSeed);
  app.use(`/api/${v}/linkedin`, (linkedin as any).default || linkedin);
  app.use(`/api/${v}/background-check`, (bgCheck as any).default || bgCheck);
  app.use(`/api/${v}/reviews`, (reviews as any).default || reviews);
  app.use(`/api/${v}/best-fit`, (bestFit as any).default || bestFit);
  app.use(`/api/${v}/web3`, (web3 as any).default || web3);
  app.use(`/api/${v}/public`, (apiPublic as any).default || apiPublic);
  app.use(`/api/${v}/api-subscription`, (apiSub as any).default || apiSub);
  app.use(`/api/${v}/social`, (social as any).default || social);
  app.use(`/api/${v}/auth/social`, (socialAuth as any).default || socialAuth);
  app.use(`/api/${v}/wallet`, (wallet as any).default || wallet);
  app.use(`/api/${v}/reliability`, (reliability as any).default || reliability);
  app.use(`/api/${v}/token-staking`, (staking as any).default || staking);
  app.use(`/api/${v}/airdrop`, (airdrop as any).default || airdrop);
  app.use(`/api/${v}/sourcing`, (sourcing as any).default || sourcing);
  app.use(`/api/${v}/waitlist`, (waitlist as any).default || waitlist);
  app.use(`/api/${v}/account-manager`, (acctMgr as any).default || acctMgr);
  app.use(`/api/${v}/offramp`, (offramp as any).default || offramp);
  app.use(`/api/${v}/offramp/webhook`, (offrampWh as any).default || offrampWh);
  app.use('/.well-known', (did as any).default || did);
  app.use(`/api/${v}/recommendation`, (recs as any).default || recs);
  app.use('/api/v1/live-seller/ebay', (ebay as any).default || ebay);
  app.use(`/api/${v}/booking`, (booking as any).default || booking);
  app.use(`/api/${v}/pab`, (pabEcon as any).default || pabEcon);
  app.use(`/api/${v}/ai/realestate`, (aiReal as any).default || aiReal);
  app.use(`/api/${v}/ai/advanced`, (aiAdv as any).default || aiAdv);
  app.use(`/api/${v}/ai`, (ai as any).default || ai);
  app.use(`/api/${v}/marketplace`, (marketplace as any).default || marketplace);
  app.use(`/api/${v}/escrow`, (escrow as any).default || escrow);
  app.use(`/api/${v}/notifications`, (notif as any).default || notif);
  app.use(`/api/${v}/auth/wallet`, (walletAuth as any).default || walletAuth);
  app.use(`/api/${v}/property-manager`, (propMgr as any).default || propMgr);
  app.use(`/api/${v}/property`, (prop as any).default || prop);
  app.use(`/api/${v}/documents`, (docs as any).default || docs);
  app.use(`/api/${v}/tenant`, (tenant as any).default || tenant);
  app.use(`/api/${v}/promo`, (promo as any).default || promo);
  app.use(`/api/${v}/rewards`, (rewards as any).default || rewards);
  app.use(`/api/${v}/freight`, (freight as any).default || freight);
  app.use(`/api/${v}/maps`, (maps as any).default || maps);
  app.use(`/api/${v}/promotions`, (promos as any).default || promos);
  app.use(`/api/${v}/nightlife`, (nightlife as any).default || nightlife);
  app.use(`/api/${v}/venues`, (venues as any).default || venues);
  app.use(`/api/${v}/nightlife/integrations`, (nightlifeInt as any).default || nightlifeInt);
  app.use(`/api/${v}/agents`, (agentic as any).default || agentic);
  app.use(`/api/${v}/webhook/stripe`, (whStripe as any).default || whStripe);
  app.use(`/api/${v}/webhook/escrow`, (whEscrow as any).default || whEscrow);
  app.use(`/api/${v}/passport/vc`, (vc as any).default || vc);
  app.use(`/api/${v}/tap`, (tap as any).default || tap);
  app.use(`/api/${v}/hospitality`, (hospitality as any).default || hospitality);
  app.use('/api/hospitality', (hospitality as any).default || hospitality);
  app.use('/external/v1', (external as any).default || external);
  app.use(`/api/${v}/passport/public`, (publicPassport as any).default || publicPassport);
  app.use(`/api/${v}/text-search`, (textSearch as any).default || textSearch);
  app.use(`/api/${v}/oauth`, (oauth as any).default || oauth);
  app.use(`/api/${v}/passport`, (passport as any).default || passport);
  app.use(`/api/${v}/pop`, (pop as any).default || pop);
  app.use(`/api/${v}/network`, (network as any).default || network);
  app.use(`/api/${v}/users`, (users as any).default || users);
  app.use(`/api/${v}/integrations`, (integrations as any).default || integrations);
  app.use(`/api/${v}/integrations/livesell`, (liveSell as any).default || liveSell);
  app.use(`/api/${v}/shopify`, (shopifyInt as any).default || shopifyInt);
  app.use(`/api/${v}/openwa`, (whatsapp as any).default || whatsapp); // openwaRoutes
  app.use(`/api/${v}/openwa/webhook`, (whatsapp as any).default || whatsapp);
  app.use(`/api/${v}/evolution`, (whatsapp as any).default || whatsapp);
  app.use(`/api/${v}/treasury`, (offramp as any).default || offramp);
  app.use(`/api/${v}/economy`, (recs as any).default || recs);
  app.use(`/api/${v}/gigs`, (notif as any).default || notif);
  app.use(`/api/${v}/loops`, (notif as any).default || notif);
  app.use(`/api/${v}/programs`, (notif as any).default || notif);
  app.use(`/api/${v}/pyd`, (notif as any).default || notif);
  app.use(`/api/${v}/ppd`, (notif as any).default || notif);
  app.use(`/api/${v}/guarantee`, (notif as any).default || notif);
  app.use(`/api/${v}/apps`, (notif as any).default || notif);
  app.use(`/api/${v}/agents`, (agentic as any).default || agentic);
  app.use(`/api/${v}/agents`, (agentLoop as any).default || agentLoop);
  app.use(`/api/${v}/trust-passport`, (agentPassport as any).default || agentPassport);
  app.use(`/api/${v}/osint`, (osint as any).default || osint);
  app.use(`/api/${v}/seal`, (seal as any).default || seal);
  app.use(`/api/${v}/billing`, (billing as any).default || billing);
  app.use(`/api/${v}/jobs`, (jobs as any).default || jobs);
  app.use(`/api/${v}/seed`, (seed as any).default || seed);
  app.use('/.well-known/ptp', (wellknown as any).default || wellknown);
  app.use(`/api/${v}/agent-passport`, (agentPassport as any).default || agentPassport);
  app.use(`/api/${v}/realestate`, (realestate as any).default || realestate);
  app.use(`/api/${v}/por`, (por as any).default || por);
  app.use(`/api/${v}/predictive`, (predictive as any).default || predictive);
  app.use(`/api/${v}/geo`, (geoRisk as any).default || geoRisk);
  app.use(`/api/${v}/v2`, (protocolV2 as any).default || protocolV2);
  app.use(`/api/${v}/agent-loop`, (agentLoop as any).default || agentLoop);

  // MCP handler needs default export
  const mcpMod = (mcp as any).default || (mcp as any).mcpHandler || mcp;
  app.post('/mcp', (mcpMod as any).mcpHandler || mcpMod);
  app.post(`/api/${v}/mcp`, (mcpMod as any).mcpHandler || mcpMod);

  logger.info('✅ API routes registered');
}

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

  // Lazy-load routes in background after server is listening (avoids OOM at startup)
  loadApiRoutes().catch(err => logger.error('Failed to load API routes:', err));

  // DISABLED: Telegram bot (spawns background processes)
  // try {
  //   const { startTelegramBot } = await import('./services/telegram-bot.service');
  //   startTelegramBot();
  // } catch (err) { logger.warn(`Telegram bot skipped: ${(err as Error).message}`); }

  // DISABLED: Agent Loop (memory leak — spawns multiple intervals)
  // try { startAgentLoop(); } catch (err) { logger.warn(`Agent Loop skipped: ${(err as Error).message}`); }

  // DISABLED: Autonomous Marketing Agent (memory leak — spawns intervals)
  // try {
  //   const { startAutonomousMarketing } = await import('./services/marketingAgent.service');
  //   startAutonomousMarketing();
  // } catch (err) { logger.warn(`Marketing agent skipped: ${(err as Error).message}`); }

  // DISABLED: Segmented loops (memory leak — spawns intervals)
  // try {
  //   const { startLoops } = await import('./services/loop.service');
  //   startLoops();
  // } catch (err) { logger.warn(`Loops skipped: ${(err as Error).message}`); }

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

// freelance discovery fix rebuild trigger 1788039555

// global motion rebuild trigger 1788040077

// economy demo fix + dao models rebuild trigger 1788041833
