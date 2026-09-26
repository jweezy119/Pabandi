"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Pabandi Server - IPv4 Pooler active
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
// DISABLED: Passport (replaced with lightweight GitHub OAuth implementation)
// import passport from 'passport';
const compression_1 = __importDefault(require("compression"));
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const rateLimiter_1 = require("./middleware/rateLimiter");
// Load environment variables FIRST
dotenv_1.default.config();
try {
    dotenv_1.default.config({ path: '.env.contracts' });
}
catch (err) {
    logger_1.logger.warn('.env.contracts not loaded');
}
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
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
    logger_1.logger.warn('DEMO_MODE enabled');
}
// Security and Performance middleware
app.set('trust proxy', 1); // Essential for rate limiting behind Cloud Run
// ── Startup sanity check: fail fast if required secrets are missing ───────────
const requiredEnvVars = [];
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
    // PayLio API key for card payments (USDC on Polygon)
    if (!process.env.PAYLIO_API_KEY) {
        requiredEnvVars.push('PAYLIO_API_KEY');
    }
    // Firebase App Check (production)
    if (process.env.REQUIRE_APP_CHECK !== 'false' && !process.env.FIREBASE_APP_CHECK_SECRET) {
        requiredEnvVars.push('FIREBASE_APP_CHECK_SECRET (set REQUIRE_APP_CHECK=false to skip)');
    }
}
if (requiredEnvVars.length > 0) {
    logger_1.logger.error(`🚨 Server starting with MISSING or weak env configuration in production:${requiredEnvVars.map(v => `\n   - ${v}`).join('')}\n` +
        `   Fix these before serving real traffic, or set NODE_ENV != 'production' to bypass the check (dev only).`);
    // Non-fatal in dev; in production this should be escalated to your deploy monitor
}
app.use((0, helmet_1.default)({
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
app.use((0, compression_1.default)());
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
app.use((0, cors_1.default)({
    origin: allowedOrigins,
    credentials: true,
}));
// Body parsing middleware — capture raw body for webhook HMAC verification
app.use(express_1.default.json({
    limit: '10mb',
    verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Request logging
app.use((req, _res, next) => {
    logger_1.logger.info(`${req.method} ${req.path}`);
    next();
});
// Rate limiting
app.use('/api/', rateLimiter_1.rateLimiter);
// DISABLED: Audit logging (runs on every request, memory overhead)
// app.use('/api/', auditLog);
// Firebase App Check Middleware for API routes — disabled to reduce startup memory (imports firebase-admin)
app.use('/api/', (_req, _res, next) => next());
// Health check endpoints
app.get('/health', (_req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
        deployVersion: '2026-09-08-migration-fix-v2',
    });
});
app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
// API Routes — lazy-loaded per-route-prefix to reduce startup memory footprint (Render 512MB limit)
// Each route prefix gets a lightweight stub that dynamically imports the real router on first request.
function lazyRoute(routePath, importPath) {
    let loadedRouter = null;
    const stub = (req, res, next) => {
        if (loadedRouter) {
            return loadedRouter(req, res, next);
        }
        Promise.resolve(`${importPath}`).then(s => __importStar(require(s))).then(mod => {
            loadedRouter = mod.default || mod;
            logger_1.logger.info(`✅ Lazy-loaded route: ${routePath} from ${importPath}`);
            loadedRouter(req, res, next);
        }).catch(err => {
            logger_1.logger.error(`Failed to lazy-load route ${routePath}:`, err);
            res.status(500).json({ success: false, error: 'Route module failed to load' });
        });
    };
    app.use(routePath, stub);
}
// Direct route registration (no lazy loading) for critical routes
function directRoute(routePath, router) {
    app.use(routePath, router);
}
// Import critical routes directly (not lazy)
const githubAuth_routes_1 = __importDefault(require("./routes/githubAuth.routes"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
// Register critical routes immediately
directRoute(`/api/${API_VERSION}/auth`, auth_routes_1.default);
directRoute(`/api/${API_VERSION}/auth/social`, githubAuth_routes_1.default);
// Lazy-load routes — modules are imported on first request, not at startup
const v = API_VERSION;
const routeMap = [
    [`/api/${v}/businesses`, './routes/business.routes'],
    [`/api/${v}/businesses/import`, './routes/businessImport.routes'],
    [`/api/${v}/reservations`, './routes/reservation.routes'],
    [`/api/${v}/disputes`, './routes/dispute.routes'],
    [`/api/${v}/loans`, './routes/loan.routes'],
    [`/api/${v}/payouts`, './routes/payout.routes'],
    [`/api/${v}/payments`, './routes/payment.routes'],
    [`/api/${v}/fiat`, './routes/fiatPayment.routes'],
    [`/api/${v}/payments/raast`, './routes/raastPayment.routes'],
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
    [`/api/${v}/public/invoices`, './routes/invoicePublic.routes'],
    [`/api/${v}/public`, './routes/api-public.routes'],
    [`/api/${v}/api-subscription`, './routes/api-subscription.routes'],
    [`/api/${v}/social`, './routes/social.routes'],
    [`/api/${v}/wallet`, './routes/wallet.routes'],
    [`/api/${v}/reliability`, './routes/reliability.routes'],
    [`/api/${v}/token-staking`, './routes/staking.routes'],
    [`/api/${v}/mudarabah`, './routes/mudarabah.routes'],
    [`/api/${v}/mudarabah-matcher`, './routes/mudarabahMatcher.routes'],
    [`/api/${v}/airdrop`, './routes/airdrop.routes'],
    [`/api/${v}/sourcing`, './routes/sourcing.routes'],
    [`/api/${v}/waitlist`, './routes/waitlist.routes'],
    [`/api/${v}/abode`, './routes/abode.routes'],
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
    [`/api/${v}/ai/business`, './routes/aiBusiness.routes'],
    [`/api/${v}/marketplace`, './routes/marketplace.routes'],
    [`/api/${v}/notifications`, './routes/notifications.routes'],
    [`/api/${v}/auth/wallet`, './routes/walletAuth.routes'],
    [`/api/${v}/property-manager`, './routes/propertyManager.routes'],
    [`/api/${v}/property`, './routes/property.routes'],
    [`/api/${v}/public/property`, './routes/public.property.routes'],
    [`/api/${v}/crm`, './routes/crm.routes'],
    [`/api/${v}/crm-advanced`, './routes/crmAdvanced.routes'],
    [`/api/${v}/team`, './routes/team.routes'],
    [`/api/${v}/documents`, './routes/document.routes'],
    [`/api/${v}/tenant`, './routes/tenant.routes'],
    [`/api/${v}/contact`, './routes.contact.routes'],
    [`/api/${v}/promo`, './routes/promo.routes'],
    [`/api/${v}/rewards`, './routes/partnerRewards.routes'],
    [`/api/${v}/freight`, './routes/freight.routes'],
    [`/api/${v}/ledger`, './routes.ledger.routes'],
    [`/api/${v}/maps`, './routes/maps.routes'],
    [`/api/${v}/promotions`, './routes/promotions.routes'],
    [`/api/${v}/nightlife`, './routes/nightlife.routes'],
    [`/api/${v}/venues`, './routes/venues.routes'],
    [`/api/${v}/venue`, './routes/venue.routes'],
    [`/api/${v}/bookings`, './routes/bottleBooking.routes'],
    [`/api/${v}/core-bookings`, './routes/coreBooking.routes'],
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
    [`/.well-known`, './routes/wellknown.routes'],
    [`/api/${v}/treasury/autonomous`, './routes/treasury.autonomous.routes'],
    [`/api/${v}/agent-loop`, './routes/agentLoop.routes'],
    [`/api/${v}/sitara`, './routes/sitaraStarPower.routes'],
    [`/api/${v}/square`, './routes/square.routes'],
    [`/api/${v}/square-checkout`, './routes/squareCheckout.routes'],
    [`/api/${v}/rewards`, './routes/reward.routes'],
    [`/api/${v}/sitara-api`, './routes/sitaraApi.routes'],
    [`/api/${v}/solana-escrow`, './routes/solanaEscrow.routes'],
    [`/api/${v}/solana-usdc`, './routes/solanaUsdc.routes'],
    [`/api/${v}/profit-engine`, './routes/profitEngine.routes'],
    [`/api/${v}/auto-approval`, './routes/autoApproval.routes'],
    [`/api/${v}/single-wallet`, './routes/singleWalletTreasury.routes'],
    [`/api/${v}/settlement`, './routes/settlement.routes'],
    [`/api/${v}/compounding`, './routes/compounding.routes'],
    [`/api/${v}/pab-dex`, './routes/pabDex.routes'],
    [`/api/${v}/onboarding`, './routes/onboarding.routes'],
    [`/api/${v}/dashboard`, './routes/dashboard.routes'],
    [`/api/${v}/jev`, './routes/jev.routes'],
    [`/api/${v}/frictionless`, './routes/frictionless.routes'],
    [`/api/${v}/recommendations`, './routes/recommendation.routes'],
    [`/api/${v}/pab-staking`, './routes/pabStaking.routes'],
    [`/api/${v}/booking-pab`, './routes/bookingPab.routes'],
    [`/api/${v}/agent-rewards`, './routes/agentReward.routes'],
    [`/api/${v}/crm-pab`, './routes/crmPab.routes'],
    [`/api/${v}/lease-pab`, './routes/leasePab.routes'],
    [`/api/${v}/security`, './routes.security.routes'],
    [`/api/${v}/pakistan`, './routes/pakistanPayment.routes'],
    [`/api/${v}/haq`, './routes/haqOS.routes'],
    [`/api/${v}/saf`, './routes/safOS.routes'],
    [`/api/${v}/builder`, './routes/builder.routes'],
    [`/api/${v}/cod`, './routes/codEscrow.routes'],
    [`/api/${v}/telegram`, './routes/telegram.routes'],
    [`/api/${v}/sms`, './routes/sms.routes'],
    [`/api/${v}/channels`, './routes/channel.routes'],
];
for (const [routePath, importPath] of routeMap) {
    lazyRoute(routePath, importPath);
}
// Lazy-load MCP handler
app.post('/mcp', async (req, res) => {
    try {
        const { mcpHandler } = await Promise.resolve().then(() => __importStar(require('./mcp/pabandiMcpServer')));
        mcpHandler(req, res);
    }
    catch (err) {
        res.status(500).json({ success: false, error: 'MCP handler failed to load' });
    }
});
app.post(`/api/${v}/mcp`, async (req, res) => {
    try {
        const { mcpHandler } = await Promise.resolve().then(() => __importStar(require('./mcp/pabandiMcpServer')));
        mcpHandler(req, res);
    }
    catch (err) {
        res.status(500).json({ success: false, error: 'MCP handler failed to load' });
    }
});
logger_1.logger.info(`✅ ${routeMap.length} lazy API routes registered`);
// Initialize TrustCore event handlers
const trust_core_service_1 = require("./services/trust-core.service");
(0, trust_core_service_1.initializeTrustCore)();
logger_1.logger.info('✅ TrustCore event pipeline initialized');
// Auto-start job cron service (checks for overdue jobs and no-shows every minute)
const jobCronService_1 = require("./services/jobCronService");
jobCronService_1.jobCronService.start();
logger_1.logger.info('✅ Job cron service auto-started (checks every minute)');
// Auto-start settlement service (runs every hour to settle agent credits on-chain)
const settlement_service_1 = require("./services/settlement.service");
settlement_service_1.settlementService.startPeriodicSettlement();
logger_1.logger.info('✅ Settlement service auto-started (hourly on-chain USDC transfers)');
// Auto-start compounding service (runs every hour to compound fees back to reserve)
const compounding_service_1 = require("./services/compounding.service");
const invoiceTrustCron_1 = require("./utils/invoiceTrustCron");
compounding_service_1.compoundingService.startPeriodicCompounding();
(0, invoiceTrustCron_1.startInvoiceTrustCron)();
logger_1.logger.info('✅ Compounding service auto-started (hourly fee reinvestment)');
// Auto-start DEX auto-trader (continuous trading for LP fees)
// TEMPORARILY DISABLED — focusing on core product first
// import { startAutoTrader } from './services/autoTrader.service';
// startAutoTrader();
// logger.info('✅ DEX Auto-trader auto-started (continuous LP fee generation)');
// Expose public SDK for trust seals
const path_1 = __importDefault(require("path"));
app.use('/sdk', express_1.default.static(path_1.default.join(__dirname, 'public')));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// ── LLMs.txt (agent discovery) ───────────────────────────────────────────────
app.get('/llms.txt', (_req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.sendFile(path_1.default.join(__dirname, 'public', 'app', 'llms.txt'), (err) => {
        if (err) {
            res.setHeader('Content-Type', 'text/plain; charset=utf-8');
            res.send('# PabandiOS\n> The trust operating system for bookings, freight, property, CRM, and finance.\n');
        }
    });
});
// ── Public Badge Verification (no auth needed) ───────────────────────────────
app.get(`/api/${API_VERSION}/badge/:pseudonymousId`, async (req, res) => {
    try {
        const { badgeService } = await Promise.resolve().then(() => __importStar(require('./services/badge.service')));
        const userId = await badgeService.resolveUserFromPseudonymousId(req.params.pseudonymousId);
        if (!userId) {
            return res.status(404).json({ success: false, error: 'Badge not found' });
        }
        const badge = await badgeService.computeBadgeStatus(userId);
        return res.json({ success: true, data: badge });
    }
    catch (error) {
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
        return res.sendFile(path_1.default.join(__dirname, 'public', 'app', 'index.html'), (err) => {
            if (err)
                res.status(200).json({ success: true, message: 'Welcome to the Pabandi Backend API', version: API_VERSION, docs: `/api/${API_VERSION}/docs`, health: '/health' });
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
const SPA_DIR = path_1.default.join(__dirname, 'public', 'app');
const SPA_INDEX = path_1.default.join(SPA_DIR, 'index.html');
// Serve built assets with long cache (hashed filenames), but force no-cache on the
// SPA shell (index.html) so Cloudflare/edge never serves a stale bundle after a deploy.
app.use((req, res, next) => {
    const p = req.path;
    if ((p === '/' || p === '/index.html') && req.method === 'GET') {
        res.setHeader('Cache-Control', 'no-cache');
    }
    next();
});
app.use(express_1.default.static(SPA_DIR));
app.use((req, res, next) => {
    if (req.method !== 'GET')
        return next();
    const p = req.path;
    if (p.startsWith('/api') || p.startsWith('/sdk') || p.startsWith('/health') || p.startsWith('/mcp')
        || p.startsWith('/well-known') || p.startsWith('/.well-known') || p.startsWith('/shopify')
        || p.startsWith('/assets') || p.startsWith('/images') || p === '/manifest.webmanifest'
        || p === '/robots.txt' || p === '/sitemap.xml' || p === '/llms.txt' || p.startsWith('/pab-')) {
        return next();
    }
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(SPA_INDEX, (err) => { if (err)
        next(); });
});
// 404 handler
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
    });
});
// Error handling middleware (must be last)
app.use(errorHandler_1.errorHandler);
// Start server
const parsedPort = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;
httpServer.listen(parsedPort, '0.0.0.0', async () => {
    logger_1.logger.info(`🚀 Server running on port ${parsedPort}`);
    logger_1.logger.info(`📚 API available at http://localhost:${parsedPort}/api/${API_VERSION}`);
    logger_1.logger.info(`🏥 Health check: http://localhost:${parsedPort}/health`);
    logger_1.logger.info(`🔑 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅ configured' : '❌ not configured'}`);
    // Routes are registered lazily via lazyRoute() at module load — no startup loading needed
    logger_1.logger.info('✅ Server ready (routes will lazy-load on first request)');
    // ── Auto-seed offline real businesses on cold start ─────────────────────
    // Ensures discovery always has geo-located data without manual seed calls.
    // Uses no external network — bundled real business coordinates. Safe in
    // production: only inserts if the Business table has zero geo rows.
    setImmediate(async () => {
        try {
            const { prisma } = await Promise.resolve().then(() => __importStar(require('./utils/database')));
            const geoCount = await prisma.business.count({ where: { latitude: { not: null }, longitude: { not: null } } });
            if (geoCount === 0) {
                logger_1.logger.info('Seeding offline real businesses (geo table empty)...');
                const { seedOfflineBusinesses } = await Promise.resolve().then(() => __importStar(require('./routes/seed.routes')));
                const count = await seedOfflineBusinesses();
                logger_1.logger.info(`✅ Auto-seeded ${count} offline businesses`);
            }
            else {
                logger_1.logger.info(`Geo businesses already present (${geoCount}); skipping auto-seed`);
            }
        }
        catch (e) {
            logger_1.logger.warn('[Auto-seed] offline businesses skipped: ' + e.message);
        }
    });
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
            logger_1.logger.error('🚨 LIVE_BOOKINGS=true but SOLANA_PRIVATE_KEY is MISSING — the loop will run in SIMULATED mode (no real on-chain transfers). Add SOLANA_PRIVATE_KEY to Render and restart to go live.');
        }
        else {
            logger_1.logger.info('✅ LIVE_BOOKINGS=true and SOLANA_PRIVATE_KEY present — live on-chain rail armed. Run POST /api/v1/agent-loop/prepare-live once the wallet is funded.');
        }
        if (!process.env.TREASURY_WALLET || process.env.TREASURY_WALLET.startsWith('PABANDi')) {
            logger_1.logger.error('🚨 TREASURY_WALLET is not set / is a placeholder — agent SOL fees would route to a non-real address.');
        }
        if (!process.env.FEE_TREASURY_WALLET || process.env.FEE_TREASURY_WALLET.startsWith('PABANDi')) {
            logger_1.logger.error('🚨 FEE_TREASURY_WALLET is not set — human SOL fees route to placeholder. Set FEE_TREASURY_WALLET.');
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
    logger_1.logger.info('SIGTERM signal received: closing HTTP server');
    try {
        const { webhookManager } = await Promise.resolve().then(() => __importStar(require('./services/openwa.webhook-manager.service')));
        await webhookManager.stop();
    }
    catch { /* ignore */ }
    httpServer.close(() => {
        logger_1.logger.info('HTTP server closed');
        process.exit(0);
    });
});
exports.default = app;
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
//# sourceMappingURL=index.js.map