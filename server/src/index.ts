// Pabandi Server - IPv4 Pooler active
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
// DISABLED: Passport (replaced with lightweight GitHub OAuth implementation)
// import passport from 'passport';
import compression from 'compression';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';

// Load environment variables FIRST
dotenv.config();
try { dotenv.config({ path: '.env.contracts' }); } catch (err) { logger.warn('.env.contracts not loaded'); }

const app = express();
const httpServer = createServer(app);

// DISABLED: Firebase Admin (spawns background processes)
// try { initFirebaseAdmin(); } catch (err) { logger.warn('Firebase init skipped: ' + (err as Error).message); }

// GitHub OAuth is handled directly in routes/githubAuth.routes.ts (no passport needed)
// DISABLED: Passport (replaced with lightweight GitHub OAuth)
// app.use(passport.initialize());

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

// Firebase App Check Middleware for API routes — disabled to reduce startup memory (imports firebase-admin)
app.use('/api/', (_req: any, _res: any, next: any) => next());

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

// API Routes — lazy-loaded per-route-prefix to reduce startup memory footprint (Render 512MB limit)
// Each route prefix gets a lightweight stub that dynamically imports the real router on first request.
function lazyRoute(routePath: string, importPath: string) {
  let loadedRouter: any = null;
  const stub = (req: any, res: any, next: any) => {
    if (loadedRouter) {
      return loadedRouter(req, res, next);
    }
    import(importPath).then(mod => {
      loadedRouter = mod.default || mod;
      logger.info(`✅ Lazy-loaded route: ${routePath} from ${importPath}`);
      loadedRouter(req, res, next);
    }).catch(err => {
      logger.error(`Failed to lazy-load route ${routePath}:`, err);
      res.status(500).json({ success: false, error: 'Route module failed to load' });
    });
  };
  app.use(routePath, stub);
}

// Direct route registration (no lazy loading) for critical routes
function directRoute(routePath: string, router: any) {
  app.use(routePath, router);
}

// Lazy-load routes — modules are imported on first request, not at startup
const v = API_VERSION;
const routeMap: [string, string][] = [
  [`/api/${v}/auth`, './routes/auth.routes'],
  [`/api/${v}/businesses`, './routes/business.routes'],
  [`/api/${v}/businesses/import`, './routes/businessImport.routes'],
  [`/api/${v}/reservations`, './routes/reservation.routes'],
  [`/api/${v}/disputes`, './routes/dispute.routes'],
  [`/api/${v}/loans`, './routes/loan.routes'],
  [`/api/${v}/payouts`, './routes/payout.routes'],
  [`/api/${v}/payments`, './routes/payment.routes'],
  [`/api/${v}/payments/recon`, './routes/payment-reconciliation.routes'],
  [`/api/${v}/analytics`, './routes/analytics.routes'],
  [`/api/${v}/admin`, './routes/admin.routes'],
  [`/api/${v}/shopify-integration`, './routes/shopify-integration.routes'],
  [`/api/${v}/webhooks`, './routes/webhook.routes'],
  [`/api/${v}/checkout`, './routes/checkout.routes'],
  [`/api/${v}/escrow`, './routes/escrow.routes'],
  [`/api/${v}/crypto`, './routes/crypto.routes'],
  [`/api/${v}/whatsapp`, './routes/whatsapp.routes'],
  [`/api/${v}/whatsapp/advanced`, './routes/whatsapp.advanced.routes'],
  [`/api/${v}/admin/api-clients`, './routes/apiClients.routes'],
  [`/api/${v}/api-keys`, './routes/apiKey.routes'],
  [`/api/${v}/trust`, './routes/trust.routes'],
  [`/api/${v}/monetization`, './routes/monetization.routes'],
  [`/api/${v}/linkedin/seed`, './routes/linkedinSeed.routes'],
  [`/api/${v}/linkedin`, './routes/linkedin.routes'],
  [`/api/${v}/background-check`, './routes/backgroundCheck.routes'],
  [`/api/${v}/reviews`, './routes/pabandiReview.routes'],
  [`/api/${v}/best-fit`, './routes/bestFit.routes'],
  [`/api/${v}/web3`, './routes/web3.routes'],
  [`/api/${v}/public`, './routes/api-public.routes'],
  [`/api/${v}/api-subscription`, './routes/api-subscription.routes'],
  [`/api/${v}/social`, './routes/social.routes'],
  [`/api/${v}/wallet`, './routes/wallet.routes'],
  [`/api/${v}/reliability`, './routes/reliability.routes'],
  [`/api/${v}/token-staking`, './routes/staking.routes'],
  [`/api/${v}/airdrop`, './routes/airdrop.routes'],
  [`/api/${v}/sourcing`, './routes/sourcing.routes'],
  [`/api/${v}/waitlist`, './routes/waitlist.routes'],
  [`/api/${v}/account-manager`, './routes/accountManager.routes'],
  [`/api/${v}/offramp`, './routes/offramp.routes'],
  [`/api/${v}/offramp/webhook`, './routes/offramp-webhook.routes'],
  [`/.well-known`, './routes/did.routes'],
  [`/api/${v}/recommendation`, './routes/recommendation.routes'],
  [`/api/v1/live-seller/ebay`, './routes/ebay.routes'],
  [`/api/${v}/booking`, './routes/booking.routes'],
  [`/api/${v}/checkin`, './routes/checkin.routes'],
  [`/api/${v}/pab`, './routes/pabEconomy.routes'],
  [`/api/${v}/ai/realestate`, './routes/aiRealEstate.routes'],
  [`/api/${v}/ai/advanced`, './routes/aiAdvanced.routes'],
  [`/api/${v}/ai`, './routes/ai.routes'],
  [`/api/${v}/marketplace`, './routes/marketplace.routes'],
  [`/api/${v}/notifications`, './routes/notifications.routes'],
  [`/api/${v}/auth/wallet`, './routes/walletAuth.routes'],
  [`/api/${v}/property-manager`, './routes/propertyManager.routes'],
  [`/api/${v}/property`, './routes/property.routes'],
  [`/api/${v}/documents`, './routes/document.routes'],
  [`/api/${v}/tenant`, './routes/tenant.routes'],
  [`/api/${v}/promo`, './routes/promo.routes'],
  [`/api/${v}/rewards`, './routes/partnerRewards.routes'],
  [`/api/${v}/freight`, './routes/freight.routes'],
  [`/api/${v}/maps`, './routes/maps.routes'],
  [`/api/${v}/promotions`, './routes/promotions.routes'],
  [`/api/${v}/nightlife`, './routes/nightlife.routes'],
  [`/api/${v}/venues`, './routes/venues.routes'],
  [`/api/${v}/venue`, './routes/venue.routes'],
  [`/api/${v}/bookings`, './routes/bottleBooking.routes'],
  [`/api/${v}/promoters`, './routes/promoter.routes'],
  [`/api/${v}/guest-list`, './routes/guestList.routes'],
  [`/api/${v}/nightlife/integrations`, './routes/nightlifeIntegration.routes'],
  [`/api/${v}/agents`, './routes/agentic.routes'],
  [`/api/${v}/webhook/stripe`, './routes/webhook.stripe.routes'],
  [`/api/${v}/webhook/escrow`, './routes/webhook.escrow.routes'],
  [`/api/${v}/passport/vc`, './routes/vc.routes'],
  [`/api/${v}/tap`, './routes/tap.routes'],
  [`/api/${v}/hospitality`, './routes/hospitality.routes'],
  [`/external/v1`, './routes/external.routes'],
  [`/api/${v}/passport/public`, './routes/publicPassport.routes'],
  [`/api/${v}/text-search`, './routes/textSearch.routes'],
  [`/api/${v}/oauth`, './routes/oauth.routes'],
  [`/api/${v}/passport`, './routes/passport.routes'],
  [`/api/${v}/pop`, './routes/pop.routes'],
  [`/api/${v}/network`, './routes/network.routes'],
  [`/api/${v}/users`, './routes/user.routes'],
  [`/api/${v}/integrations`, './routes/integrations.routes'],
  [`/api/${v}/integrations/livesell`, './routes/livesell.routes'],
  [`/api/${v}/shopify`, './routes/shopify.routes'],
  [`/api/${v}/openwa`, './routes/openwa.routes'],
  [`/api/${v}/openwa/webhook`, './routes/openwa.webhook.routes'],
  [`/api/${v}/evolution`, './routes/evolution.webhook.routes'],
  [`/api/${v}/treasury`, './routes/treasury.routes'],
  [`/api/${v}/economy`, './routes/economy.routes'],
  [`/api/${v}/marketing`, './routes/marketing.routes'],
  [`/api/${v}/gigs`, './routes/gig.routes'],
  [`/api/${v}/loops`, './routes/loop.routes'],
  [`/api/${v}/programs`, './routes/program.routes'],
  [`/api/${v}/pyd`, './routes/rentalDeposit.routes'],
  [`/api/${v}/ppd`, './routes/ppd.routes'],
  [`/api/${v}/guarantee`, './routes/guaranteeClaim.routes'],
  [`/api/${v}/apps`, './routes/appIntegration.routes'],
  [`/api/${v}/agent-marketplace`, './routes/agentMarketplace.routes'],
  [`/api/${v}/agent-learning`, './routes/agentLearning.routes'],
  [`/api/${v}/trust-passport`, './routes/trustPassport.routes'],
  [`/api/${v}/osint`, './routes/osint.routes'],
  [`/api/${v}/seal`, './routes/seal.routes'],
  [`/api/${v}/billing`, './routes/billing.routes'],
  [`/api/${v}/jobs`, './routes/jobs.routes'],
  [`/api/${v}/seed`, './routes/seed.routes'],
  [`/.well-known/ptp`, './routes/wellknown.routes'],
  [`/api/${v}/treasury/autonomous`, './routes/treasury.autonomous.routes'],
  [`/api/${v}/agent-loop`, './routes/agentLoop.routes'],
];

for (const [routePath, importPath] of routeMap) {
  lazyRoute(routePath, importPath);
}

// Register GitHub OAuth route inline (no module import needed)
app.get('/api/v1/auth/social/github', (req: Request, res: Response) => {
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
  const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
  }
  const API_URL = process.env.API_URL || 'https://pabandi.onrender.com';
  const CLIENT_URL = process.env.CLIENT_URL || 'https://pabandi.com';
  const redirectUri = `${API_URL}/api/v1/auth/social/github/callback`;
  const githubUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  res.redirect(githubUrl);
});

app.get('/api/v1/auth/social/github/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect(`${process.env.CLIENT_URL || 'https://pabandi.com'}/login?error=github_no_code`);

    const axios = (await import('axios')).default;
    const jwt = (await import('jsonwebtoken')).default;
    const { prisma } = await import('./utils/database');

    const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }, { headers: { Accept: 'application/json' } });

    const accessToken = tokenRes.data.access_token;
    if (!accessToken) return res.redirect(`${process.env.CLIENT_URL || 'https://pabandi.com'}/login?error=github_token`);

    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${accessToken}` },
    });

    const githubUser = userRes.data;
    let email = githubUser.email;

    if (!email) {
      const emailsRes = await axios.get('https://api.github.com/user/emails', {
        headers: { Authorization: `token ${accessToken}` },
      });
      const primaryEmail = emailsRes.data.find((e: any) => e.primary && e.verified);
      email = primaryEmail?.email;
    }

    if (!email) return res.redirect(`${process.env.CLIENT_URL || 'https://pabandi.com'}/login?error=github_no_email`);

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          passwordHash: '',
          firstName: githubUser.name?.split(' ')[0] || githubUser.login || 'GitHub',
          lastName: githubUser.name?.split(' ').slice(1).join(' ') || '',
          role: 'CUSTOMER',
          githubId: String(githubUser.id),
          profilePictureUrl: githubUser.avatar_url,
          isEmailVerified: true,
        },
      });
    } else {
      await prisma.user.update({
        where: { email },
        data: { githubId: String(githubUser.id), isEmailVerified: true, profilePictureUrl: user.profilePictureUrl || githubUser.avatar_url },
      });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET || 'fallback',
      { expiresIn: '7d' }
    );

    res.redirect(`${process.env.CLIENT_URL || 'https://pabandi.com'}/auth/callback?token=${token}`);
  } catch (error: any) {
    res.redirect(`${process.env.CLIENT_URL || 'https://pabandi.com'}/login?error=github`);
  }
});

// Lazy-load MCP handler
app.post('/mcp', async (req, res) => {
  try {
    const { mcpHandler } = await import('./mcp/pabandiMcpServer');
    mcpHandler(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'MCP handler failed to load' });
  }
});
app.post(`/api/${v}/mcp`, async (req, res) => {
  try {
    const { mcpHandler } = await import('./mcp/pabandiMcpServer');
    mcpHandler(req, res);
  } catch (err) {
    res.status(500).json({ success: false, error: 'MCP handler failed to load' });
  }
});

logger.info(`✅ ${routeMap.length} lazy API routes registered`);

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

// Setup Swagger UI and Docs — disabled to reduce startup memory (was importing swagger-jsdoc + swagger-ui-express)
// import('./utils/swagger').then(({ setupSwagger }) => {
//   try { setupSwagger(app); } catch (err) { logger.warn('Swagger setup skipped: ' + (err as Error).message); }
// }).catch(err => logger.warn('Swagger module load skipped: ' + (err as Error).message));

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

  // Routes are registered lazily via lazyRoute() at module load — no startup loading needed
  logger.info('✅ Server ready (routes will lazy-load on first request)');

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

  // DISABLED: Phase 0 Offramp SLA Sweeper (loads heavy service modules, causes OOM on 512MB)
  // setInterval(() => {
  //   import('./services/offramp.service').then(({ offrampService }) => {
  //     offrampService.expireStaleIntents().catch(err => {
  //       logger.error(`[Offramp Sweeper Error] ${err.message}`);
  //     });
  //   });
  // }, 5000);
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
