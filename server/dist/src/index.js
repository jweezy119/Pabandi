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
const passport_1 = __importDefault(require("passport"));
const compression_1 = __importDefault(require("compression"));
const errorHandler_1 = require("./middleware/errorHandler");
const logger_1 = require("./utils/logger");
const rateLimiter_1 = require("./middleware/rateLimiter");
const audit_middleware_1 = require("./middleware/audit.middleware");
const passport_2 = require("./utils/passport");
const dbKeepalive_1 = require("./utils/dbKeepalive");
const firebase_1 = require("./utils/firebase");
const appCheck_middleware_1 = require("./middleware/appCheck.middleware");
// Load environment variables FIRST
dotenv_1.default.config();
try {
    dotenv_1.default.config({ path: '.env.contracts' });
}
catch (err) {
    logger_1.logger.warn('.env.contracts not loaded');
}
const swagger_1 = require("./utils/swagger");
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const whatsapp_routes_1 = __importDefault(require("./routes/whatsapp.routes"));
const whatsapp_advanced_routes_1 = __importDefault(require("./routes/whatsapp.advanced.routes"));
const business_routes_1 = __importDefault(require("./routes/business.routes"));
const reservation_routes_1 = __importDefault(require("./routes/reservation.routes"));
const payment_routes_1 = __importDefault(require("./routes/payment.routes"));
const analytics_routes_1 = __importDefault(require("./routes/analytics.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const webhook_routes_1 = __importDefault(require("./routes/webhook.routes"));
const crypto_routes_1 = __importDefault(require("./routes/crypto.routes"));
const external_routes_1 = __importDefault(require("./routes/external.routes"));
const apiClients_routes_1 = __importDefault(require("./routes/apiClients.routes"));
const apiKey_routes_1 = __importDefault(require("./routes/apiKey.routes"));
const social_routes_1 = __importDefault(require("./routes/social.routes"));
const checkout_routes_1 = __importDefault(require("./routes/checkout.routes"));
const wallet_routes_1 = __importDefault(require("./routes/wallet.routes"));
const waitlist_routes_1 = __importDefault(require("./routes/waitlist.routes"));
const hospitality_routes_1 = __importDefault(require("./routes/hospitality.routes"));
const trust_routes_1 = __importDefault(require("./routes/trust.routes"));
const pabandiReview_routes_1 = __importDefault(require("./routes/pabandiReview.routes"));
const recommendation_routes_1 = __importDefault(require("./routes/recommendation.routes"));
const dispute_routes_1 = __importDefault(require("./routes/dispute.routes"));
const escrow_routes_1 = __importDefault(require("./routes/escrow.routes"));
const loan_routes_1 = __importDefault(require("./routes/loan.routes"));
const shopify_integration_routes_1 = __importDefault(require("./routes/shopify-integration.routes"));
const openwa_routes_1 = __importDefault(require("./routes/openwa.routes"));
const openwa_webhook_routes_1 = __importDefault(require("./routes/openwa.webhook.routes"));
const evolution_webhook_routes_1 = __importDefault(require("./routes/evolution.webhook.routes"));
const treasury_routes_1 = __importDefault(require("./routes/treasury.routes"));
const treasury_autonomous_routes_1 = __importDefault(require("./routes/treasury.autonomous.routes"));
const economy_routes_1 = __importDefault(require("./routes/economy.routes"));
const marketing_routes_1 = __importDefault(require("./routes/marketing.routes"));
const gig_routes_1 = __importDefault(require("./routes/gig.routes"));
const loop_routes_1 = __importDefault(require("./routes/loop.routes"));
const program_routes_1 = __importDefault(require("./routes/program.routes"));
const rentalDeposit_routes_1 = __importDefault(require("./routes/rentalDeposit.routes"));
const ppd_routes_1 = __importDefault(require("./routes/ppd.routes"));
const guaranteeClaim_routes_1 = __importDefault(require("./routes/guaranteeClaim.routes"));
const appIntegration_routes_1 = __importDefault(require("./routes/appIntegration.routes"));
const agentMarketplace_routes_1 = __importDefault(require("./routes/agentMarketplace.routes"));
const agentLearning_routes_1 = require("./routes/agentLearning.routes");
const trustPassport_routes_1 = __importDefault(require("./routes/trustPassport.routes"));
const payout_routes_1 = __importDefault(require("./routes/payout.routes"));
const accountManager_routes_1 = __importDefault(require("./routes/accountManager.routes"));
const offramp_routes_1 = __importDefault(require("./routes/offramp.routes"));
const offramp_webhook_routes_1 = __importDefault(require("./routes/offramp-webhook.routes"));
const webhook_stripe_routes_1 = __importDefault(require("./routes/webhook.stripe.routes"));
const webhook_escrow_routes_1 = __importDefault(require("./routes/webhook.escrow.routes"));
const did_routes_1 = __importDefault(require("./routes/did.routes"));
const vc_routes_1 = __importDefault(require("./routes/vc.routes"));
const ebay_routes_1 = __importDefault(require("./routes/ebay.routes"));
const monetization_routes_1 = __importDefault(require("./routes/monetization.routes"));
const linkedin_routes_1 = __importDefault(require("./routes/linkedin.routes"));
const linkedinSeed_routes_1 = __importDefault(require("./routes/linkedinSeed.routes"));
const backgroundCheck_routes_1 = __importDefault(require("./routes/backgroundCheck.routes"));
const agentLoop_service_1 = require("./services/agentLoop.service");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
// Initialize Firebase Admin globally
try {
    (0, firebase_1.initFirebaseAdmin)();
}
catch (err) {
    logger_1.logger.warn('Firebase init skipped: ' + err.message);
}
// Configure Passport strategies (env vars loaded above)
try {
    (0, passport_2.configurePassport)();
}
catch (err) {
    logger_1.logger.warn('Passport init skipped: ' + err.message);
}
app.use(passport_1.default.initialize());
// Start DB keepalive to prevent Supabase free-tier pause
try {
    (0, dbKeepalive_1.startDbKeepalive)();
}
catch (err) {
    logger_1.logger.warn('DB keepalive skipped: ' + err.message);
}
const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 5000);
const API_VERSION = process.env.API_VERSION || 'v1';
const DEMO_MODE = process.env.DEMO_MODE === 'true';
if (DEMO_MODE) {
    logger_1.logger.warn('DEMO_MODE enabled');
}
// Security and Performance middleware
app.set('trust proxy', 1); // Essential for rate limiting behind Cloud Run
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
const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/app\/?$/, '');
app.use((0, cors_1.default)({
    origin: [frontendOrigin, 'http://localhost:3000', 'http://localhost:5500', 'https://pabandi-42c5b.web.app', 'https://pabandi.com', 'https://www.pabandi.com'].filter((v, i, a) => v && a.indexOf(v) === i),
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
// Audit logging (runs for all routes starting with /api/)
app.use('/api/', audit_middleware_1.auditLog);
// Firebase App Check Middleware for API routes
app.use('/api/', appCheck_middleware_1.requireAppCheck);
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
app.use(`/api/${API_VERSION}/auth`, auth_routes_1.default);
app.use(`/api/${API_VERSION}/businesses`, business_routes_1.default);
app.use(`/api/${API_VERSION}/reservations`, reservation_routes_1.default);
app.use(`/api/${API_VERSION}/disputes`, dispute_routes_1.default);
app.use(`/api/${API_VERSION}/loans`, loan_routes_1.default);
app.use(`/api/${API_VERSION}/payouts`, payout_routes_1.default);
app.use(`/api/${API_VERSION}/payments`, payment_routes_1.default);
const payment_reconciliation_routes_1 = __importDefault(require("./routes/payment-reconciliation.routes"));
app.use(`/api/${API_VERSION}/payments`, payment_reconciliation_routes_1.default);
app.use(`/api/${API_VERSION}/analytics`, analytics_routes_1.default);
app.use(`/api/${API_VERSION}/admin`, admin_routes_1.default);
app.use(`/api/${API_VERSION}/shopify-integration`, shopify_integration_routes_1.default);
app.use(`/api/${API_VERSION}/webhooks`, webhook_routes_1.default);
app.use(`/api/${API_VERSION}/checkout`, checkout_routes_1.default);
app.use(`/api/${API_VERSION}/escrow`, escrow_routes_1.default);
app.use(`/api/${API_VERSION}/crypto`, crypto_routes_1.default);
// app.use(`/api/${API_VERSION}/badges`, badgeRoutes);
app.use(`/api/${API_VERSION}/whatsapp`, whatsapp_routes_1.default);
app.use(`/api/${API_VERSION}/whatsapp/advanced`, whatsapp_advanced_routes_1.default);
app.use(`/api/${API_VERSION}/admin/api-clients`, apiClients_routes_1.default);
app.use(`/api/${API_VERSION}/api-keys`, apiKey_routes_1.default);
app.use(`/api/${API_VERSION}/trust`, trust_routes_1.default);
app.use(`/api/${API_VERSION}/monetization`, monetization_routes_1.default);
app.use(`/api/${API_VERSION}/linkedin/seed`, linkedinSeed_routes_1.default);
app.use(`/api/${API_VERSION}/linkedin`, linkedin_routes_1.default);
app.use(`/api/${API_VERSION}/background-check`, backgroundCheck_routes_1.default);
app.use(`/api/${API_VERSION}/reviews`, pabandiReview_routes_1.default);
const ai_routes_1 = __importDefault(require("./routes/ai.routes"));
app.use(`/api/${API_VERSION}/ai`, ai_routes_1.default);
const bestFit_routes_1 = __importDefault(require("./routes/bestFit.routes"));
app.use(`/api/${API_VERSION}/best-fit`, bestFit_routes_1.default);
const web3_routes_1 = __importDefault(require("./routes/web3.routes"));
app.use(`/api/${API_VERSION}/web3`, web3_routes_1.default);
const api_public_routes_1 = __importDefault(require("./routes/api-public.routes"));
app.use(`/api/${API_VERSION}/public`, api_public_routes_1.default);
const api_subscription_routes_1 = __importDefault(require("./routes/api-subscription.routes"));
app.use(`/api/${API_VERSION}/api-subscription`, api_subscription_routes_1.default);
const reliability_routes_1 = __importDefault(require("./routes/reliability.routes"));
const staking_routes_1 = __importDefault(require("./routes/staking.routes"));
const airdrop_routes_1 = __importDefault(require("./routes/airdrop.routes"));
const sourcing_routes_1 = __importDefault(require("./routes/sourcing.routes"));
app.use(`/api/${API_VERSION}/social`, social_routes_1.default);
app.use(`/api/${API_VERSION}/wallet`, wallet_routes_1.default);
app.use(`/api/${API_VERSION}/reliability`, reliability_routes_1.default);
app.use(`/api/${API_VERSION}/token-staking`, staking_routes_1.default);
app.use(`/api/${API_VERSION}/airdrop`, airdrop_routes_1.default);
app.use(`/api/${API_VERSION}/sourcing`, sourcing_routes_1.default);
app.use(`/api/${API_VERSION}/waitlist`, waitlist_routes_1.default);
app.use(`/api/${API_VERSION}/account-manager`, accountManager_routes_1.default);
app.use(`/api/${API_VERSION}/offramp`, offramp_routes_1.default);
app.use(`/api/${API_VERSION}/offramp/webhook`, offramp_webhook_routes_1.default);
app.use('/.well-known', did_routes_1.default);
app.use(`/api/${API_VERSION}/recommendation`, recommendation_routes_1.default);
app.use('/api/v1/live-seller/ebay', ebay_routes_1.default);
app.use(`/api/${API_VERSION}/webhook/stripe`, webhook_stripe_routes_1.default);
app.use(`/api/${API_VERSION}/webhook/escrow`, webhook_escrow_routes_1.default);
// W3C Verifiable Credentials (OBv3)
app.use(`/api/${API_VERSION}/passport/vc`, vc_routes_1.default);
const tap_routes_1 = __importDefault(require("./routes/tap.routes"));
app.use(`/api/${API_VERSION}/tap`, tap_routes_1.default);
app.use(`/api/${API_VERSION}/hospitality`, hospitality_routes_1.default);
app.use('/api/hospitality', hospitality_routes_1.default); // Short alias for PMS webhooks
// ── Pabandi Intelligence API (B2B) ──────────────────────────────────────────
// Separate from /api/v1/ so it can be independently rate-limited and versioned
app.use('/external/v1', external_routes_1.default);
// ── Public Passport summary (no auth) ─────────────────────────────────────
const publicPassport_routes_1 = __importDefault(require("./routes/publicPassport.routes"));
app.use(`/api/${API_VERSION}/passport/public`, publicPassport_routes_1.default);
const textSearch_routes_1 = __importDefault(require("./routes/textSearch.routes"));
app.use(`/api/${API_VERSION}/text-search`, textSearch_routes_1.default);
const oauth_routes_1 = __importDefault(require("./routes/oauth.routes"));
app.use(`/api/${API_VERSION}/oauth`, oauth_routes_1.default);
// ── Pabandi Reliability Passport API (Public, API-key gated) ─────────────────
const passport_routes_1 = __importDefault(require("./routes/passport.routes"));
app.use(`/api/${API_VERSION}/passport`, passport_routes_1.default);
// ── Proof-of-Presence API ──────────────────────────────────────────
const pop_routes_1 = __importDefault(require("./routes/pop.routes"));
app.use(`/api/${API_VERSION}/pop`, pop_routes_1.default);
// ── Zero-Knowledge Network API (Shopify/E-Commerce Plugins) ──────────────────
const network_routes_1 = __importDefault(require("./routes/network.routes"));
app.use(`/api/${API_VERSION}/network`, network_routes_1.default);
const user_routes_1 = __importDefault(require("./routes/user.routes"));
app.use(`/api/${API_VERSION}/users`, user_routes_1.default);
// ── Omni-Channel Integrations API (TikTok Shop Webhooks, etc) ────────────────
const integrations_routes_1 = __importDefault(require("./routes/integrations.routes"));
const livesell_routes_1 = __importDefault(require("./routes/livesell.routes"));
const shopify_routes_1 = __importDefault(require("./routes/shopify.routes"));
app.use(`/api/${API_VERSION}/integrations`, integrations_routes_1.default);
app.use(`/api/${API_VERSION}/integrations/livesell`, livesell_routes_1.default);
app.use(`/api/${API_VERSION}/shopify`, shopify_routes_1.default);
app.use(`/api/${API_VERSION}/openwa`, openwa_routes_1.default);
app.use(`/api/${API_VERSION}/openwa/webhook`, openwa_webhook_routes_1.default);
app.use(`/api/${API_VERSION}/evolution`, evolution_webhook_routes_1.default);
app.use(`/api/${API_VERSION}/treasury`, treasury_routes_1.default);
app.use(`/api/${API_VERSION}/treasury`, treasury_autonomous_routes_1.default);
app.use(`/api/${API_VERSION}/economy`, economy_routes_1.default);
app.use(`/api/${API_VERSION}/marketing`, marketing_routes_1.default);
app.use(`/api/${API_VERSION}/gigs`, gig_routes_1.default);
app.use(`/api/${API_VERSION}/loops`, loop_routes_1.default);
app.use(`/api/${API_VERSION}/programs`, program_routes_1.default);
app.use(`/api/${API_VERSION}/pyd`, rentalDeposit_routes_1.default);
app.use(`/api/${API_VERSION}/ppd`, ppd_routes_1.default);
app.use(`/api/${API_VERSION}/guarantee`, guaranteeClaim_routes_1.default);
app.use(`/api/${API_VERSION}/apps`, appIntegration_routes_1.default);
app.use(`/api/${API_VERSION}/agents`, agentMarketplace_routes_1.default);
app.use(`/api/${API_VERSION}/agents`, agentLearning_routes_1.agentLearningRoutes);
app.use(`/api/${API_VERSION}/trust-passport`, trustPassport_routes_1.default);
// ── OSINT Intelligence Layer (Threat Fusion, Adversarial Graph, Biometrics) ──
const osint_routes_1 = __importDefault(require("./routes/osint.routes"));
app.use(`/api/${API_VERSION}/osint`, osint_routes_1.default);
// ── PTP: Pabandi Trust Protocol (Seals, Billing, Discovery) ──────────────────
const seal_routes_1 = __importDefault(require("./routes/seal.routes"));
const billing_routes_1 = __importDefault(require("./routes/billing.routes"));
const wellknown_routes_1 = __importDefault(require("./routes/wellknown.routes"));
const agentPassport_routes_1 = __importDefault(require("./routes/agentPassport.routes"));
const realestate_routes_1 = __importDefault(require("./routes/realestate.routes"));
const predictive_routes_1 = __importDefault(require("./routes/predictive.routes"));
const geoRisk_routes_1 = __importDefault(require("./routes/geoRisk.routes"));
const protocolV2_routes_1 = __importDefault(require("./routes/protocolV2.routes"));
const agentLoop_routes_1 = __importDefault(require("./routes/agentLoop.routes"));
const pabandiMcpServer_1 = require("./mcp/pabandiMcpServer");
const jobs_routes_1 = __importDefault(require("./routes/jobs.routes"));
const seed_routes_1 = __importDefault(require("./routes/seed.routes"));
app.use(`/api/${API_VERSION}/seal`, seal_routes_1.default);
app.use(`/api/${API_VERSION}/billing`, billing_routes_1.default);
app.use(`/api/${API_VERSION}/jobs`, jobs_routes_1.default);
app.use(`/api/${API_VERSION}/seed`, seed_routes_1.default);
app.use('/.well-known/ptp', wellknown_routes_1.default); // Note: standard .well-known structure
app.get('/.well-known/ptp.json', async (req, res) => {
    const { ptpEngine } = await Promise.resolve().then(() => __importStar(require('./protocol/ptp.spec')));
    const base = `${req.protocol}://${req.get('host')}`;
    res.json(ptpEngine.getDiscoveryDocument(base));
});
app.use(`/api/${API_VERSION}/agent-passport`, agentPassport_routes_1.default); // AI-agent trust standard (issue/verify)
app.use(`/api/${API_VERSION}/realestate`, realestate_routes_1.default); // ZK real-estate/hospitality escrow proofs
app.use(`/api/${API_VERSION}/predictive`, predictive_routes_1.default); // Predictive Intelligence (risk + demand + slots)
app.use(`/api/${API_VERSION}/geo`, geoRisk_routes_1.default); // Geospatial Risk Oracle (property + dual-risk pricing)
app.use(`/api/${API_VERSION}/v2`, protocolV2_routes_1.default); // Pabandi Protocol v2.0: ZK / ACTUS / Kleros / Aragon / Mesh
app.use(`/api/${API_VERSION}/agent-loop`, agentLoop_routes_1.default); // AI-agent booking loop control (live/sim)
app.post('/mcp', pabandiMcpServer_1.mcpHandler); // Model Context Protocol — Pabandi Agent Passport distribution layer
app.post(`/api/${API_VERSION}/mcp`, pabandiMcpServer_1.mcpHandler); // alias for path-prefixed clients
// Expose public SDK for trust seals
const path_1 = __importDefault(require("path"));
app.use('/sdk', express_1.default.static(path_1.default.join(__dirname, 'public')));
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
// Setup Swagger UI and Docs
(0, swagger_1.setupSwagger)(app);
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
    // Start OpenWA webhook manager (registers handlers and webhook with OpenWA)
    try {
        const { registerWebhookHandlers } = await Promise.resolve().then(() => __importStar(require('./services/openwa.webhook-handler.service')));
        const { webhookManager } = await Promise.resolve().then(() => __importStar(require('./services/openwa.webhook-manager.service')));
        registerWebhookHandlers();
        webhookManager.start().catch(err => logger_1.logger.warn(`OpenWA webhook manager start deferred: ${err?.message}`));
        logger_1.logger.info('📡 OpenWA webhook manager initialized');
    }
    catch (err) {
        logger_1.logger.warn(`OpenWA webhook manager skipped: ${err.message}`);
    }
    // Start Telegram LP Bot
    try {
        const { startTelegramBot } = await Promise.resolve().then(() => __importStar(require('./services/telegram-bot.service')));
        startTelegramBot();
    }
    catch (err) {
        logger_1.logger.warn(`Telegram bot skipped: ${err.message}`);
    }
    // Start Agent Loop (badge purchases → bookings → pool fee collection)
    try {
        (0, agentLoop_service_1.startAgentLoop)();
        logger_1.logger.info('🤖 AI Agent Loop started');
    }
    catch (err) {
        logger_1.logger.warn(`Agent loop skipped: ${err.message}`);
    }
    // Start Autonomous Marketing Agent (DRY_RUN by default; opt-in LIVE via SOCIAL_LIVE + MARKETING_AUTONOMOUS)
    try {
        const { startAutonomousMarketing } = await Promise.resolve().then(() => __importStar(require('./services/marketingAgent.service')));
        startAutonomousMarketing();
    }
    catch (err) {
        logger_1.logger.warn(`Marketing agent skipped: ${err.message}`);
    }
    // Start SEGMENTED autonomous loops: project owners (post gigs) + freelancers (book+complete).
    // Opt-in via AUTONOMOUS_LOOPS=true (off by default so nothing surprises you).
    try {
        const { startLoops } = await Promise.resolve().then(() => __importStar(require('./services/loop.service')));
        startLoops();
        logger_1.logger.info('🔁 Segmented loops registered (project-owners + freelancers)');
    }
    catch (err) {
        logger_1.logger.warn(`Loops skipped: ${err.message}`);
    }
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
    // Start Phase 0 Offramp SLA Sweeper
    setInterval(() => {
        Promise.resolve().then(() => __importStar(require('./services/offramp.service'))).then(({ offrampService }) => {
            offrampService.expireStaleIntents().catch(err => {
                logger_1.logger.error(`[Offramp Sweeper Error] ${err.message}`);
            });
        });
    }, 5000);
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
//# sourceMappingURL=index.js.map