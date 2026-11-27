import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import compression from 'compression';
import path from 'path';
import session from 'express-session';
import cookieSession from 'cookie-session';
import crypto from 'crypto';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
// Type-only: app.ts never runs the check itself, it only stores and reports the
// result that server.ts passes in.
import type { SchemaCheckResult } from './services/schema-check.service';
import { rateLimiter } from './middleware/rateLimiter';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { apiRouter } from './routes/index';
import mcpRouter from './routes/mcp.routes';
import wellknownRouter from './routes/wellknown.routes';
import { getPaidProofByPublicId } from './services/paidProof.service';
import { getBootstrapStatus } from './utils/tableBootstrap';
import { initializeDataRetention } from './services/cron.service';

// Extend Express Request for session userId/csrfToken
declare global {
  namespace Express {
    interface Session {
      userId?: string;
      csrfToken?: string;
    }
    interface Request {
      cookies?: Record<string, string>;
    }
  }
}

// Load environment variables FIRST
dotenv.config();
try {
  dotenv.config({ path: '.env.contracts' });
} catch {
  logger.warn('.env.contracts not loaded');
}

process.env.PABANDI_STARTED_AT ||= new Date().toISOString();

export const app = express();

const API_VERSION = process.env.API_VERSION || 'v1';
const DEMO_MODE = process.env.DEMO_MODE === 'true';

// FATAL CHECK: DEMO_MODE must never be enabled in production
if (DEMO_MODE && process.env.NODE_ENV === 'production') {
  logger.error('🚨 FATAL: DEMO_MODE cannot be enabled in production! Halting process immediately.');
  process.exit(1);
}

// Security and Performance middleware
app.set('trust proxy', 1);

// Content Security Policy - tightened (no unsafe-inline or unsafe-eval in scripts)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://maps.googleapis.com', 'https://telegram.org'],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'blob:',
          'https://images.unsplash.com',
          'https://maps.gstatic.com',
          'https://maps.googleapis.com',
          'https://lh3.googleusercontent.com',
          'https://cryptologos.cc',
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://cdnjs.cloudflare.com',
          'https://pabandi.onrender.com',
          'https://auth.privy.io',
          'https://*.privy.io',
          'https://privy-assets-public.s3.amazonaws.com',
          'https://explorer-api.walletconnect.com',
          'https://*.walletconnect.com',
          'https://*.walletconnect.org',
        ],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https:', 'data:'],
        connectSrc: [
          "'self'",
          'https://pabandi-42c5b.web.app',
          'https://pabandi.com',
          'https://www.pabandi.com',
          'https://pabandi.onrender.com',
          'http://localhost:5000',
          'http://127.0.0.1:5000',
          'https://maps.googleapis.com',
          'https://api.devnet.solana.com',
          'wss://api.devnet.solana.com',
          'https://api.mainnet-beta.solana.com',
          'https://nominatim.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://auth.privy.io',
          'https://*.rpc.privy.systems',
          'https://explorer-api.walletconnect.com',
          'wss://relay.walletconnect.com',
          'wss://relay.walletconnect.org',
          'wss://www.walletlink.org',
        ],
        frameSrc: [
          "'self'",
          'https://www.google.com',
          'https://storage.googleapis.com',
          'https://pabandi.onrender.com',
          'https://auth.privy.io',
          'https://verify.walletconnect.com',
          'https://verify.walletconnect.org',
        ],
        objectSrc: ["'none'"],
        frameAncestors: ["'self'", 'https://*.myshopify.com', 'https://admin.shopify.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
    // HSTS - enforce HTTPS for 1 year, include subdomains, preload eligible
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS filter (legacy but harmless)
    xssFilter: true,
    // Referrer policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

app.use(compression());

// CORS configuration
const corsOrigins = [
  'http://localhost:3000',
  'http://localhost:5500',
  'https://pabandi-42c5b.web.app',
  'https://pabandi.com',
  'https://www.pabandi.com',
];

const isProductionEnv = process.env.NODE_ENV === 'production';
const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/app\/?$/, '');
const productionOrigins = [frontendOrigin, 'https://pabandi-42c5b.web.app', 'https://pabandi.com', 'https://www.pabandi.com'];

const allowedOrigins = isProductionEnv
  ? productionOrigins.filter((v, i, a) => v && a.indexOf(v) === i)
  : corsOrigins.filter((v, i, a) => v && a.indexOf(v) === i);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'x-api-key', 'X-CSRF-Token'],
  })
);

// Session configuration (express-session for server-side, cookie-session for client-side)
// Uses separate secrets; both required in production
const sessionSecret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
const cookieSessionSecret = process.env.COOKIE_SESSION_SECRET || process.env.JWT_SECRET;

// Both session middlewares already fall back to JWT_SECRET. Only fail when
// there is no secret at all — requiring two *extra* variables that Render's
// blueprint never provisioned took the whole API down on every deploy.
if (!sessionSecret || !cookieSessionSecret) {
  logger.error('🚨 FATAL: no session secret available (set SESSION_SECRET, COOKIE_SESSION_SECRET, or JWT_SECRET)');
  process.exit(1);
}

if (isProductionEnv && (!process.env.SESSION_SECRET || !process.env.COOKIE_SESSION_SECRET)) {
  logger.warn(
    'SESSION_SECRET/COOKIE_SESSION_SECRET not set; sessions are signed with JWT_SECRET. ' +
      'Set distinct 32+ character values to separate session signing from JWT signing.',
  );
}

// express-session for server-side session store (used by passport, OAuth callbacks)
app.use(
  session({
    name: 'pabandi.sid',
    secret: sessionSecret!,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      secure: isProductionEnv,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      domain: isProductionEnv ? '.pabandi.com' : undefined,
    },
    genid: () => crypto.randomBytes(16).toString('hex'),
  })
);

// cookie-session for lightweight client-side session (CSRF token, flash messages)
app.use(
  cookieSession({
    name: 'pabandi.csrf',
    keys: [cookieSessionSecret!],
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    secure: isProductionEnv,
    httpOnly: true,
    sameSite: 'lax',
    domain: isProductionEnv ? '.pabandi.com' : undefined,
  })
);

// CSRF token generation middleware (runs after sessions are initialized)
app.use((req: any, _res: Response, next: NextFunction) => {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  // Also expose in cookie-session for client-side access
  if (req.session && !req.session['csrfToken']) {
    req.session['csrfToken'] = req.session.csrfToken;
  }
  next();
});

// CSRF protection for session-based auth (cookie sessions)
// Validates X-CSRF-Token header on state-changing requests when session cookie is present
app.use((req: any, res: Response, next: NextFunction) => {
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  const session = req.session as { userId?: string; csrfToken?: string } | undefined;
  const hasSession = session?.userId || req.cookies?.['connect.sid'];
  
  if (mutatingMethods.includes(req.method) && hasSession) {
    const csrfToken = req.headers['x-csrf-token'] || req.headers['x-xsrf-token'];
    const sessionCsrf = session?.csrfToken;
    
    if (!csrfToken || !sessionCsrf || csrfToken !== sessionCsrf) {
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token',
      });
    }
  }
  next();
});

// Square and payment webhooks raw body capture for cryptographic verification
app.use(
  [
    '/api/v1/payments/square-webhook',
    '/api/v1/square-checkout/webhook',
    '/api/v1/square/webhook',
    '/api/v1/webhook/square',
    '/api/v1/offramp/webhook',
    '/api/v1/telegram/webhook',
  ],
  express.raw({ type: 'application/json', limit: '10mb' })
);

// JSON body parsing with rawBody capture
app.use(
  express.json({
    limit: '10mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracing & logging
app.use(requestIdMiddleware);
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// API responses are dynamic and often authenticated. Say so explicitly so
// Cloudflare and browsers do not store them even if a route forgets to set
// its own Cache-Control.
app.use('/api/', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

// Cache middleware for read-heavy public GET endpoints
const CACHEABLE_GET_PATHS = [
  '/api/v1/booking/businesses',
  '/api/v1/booking/',
  '/api/v1/businesses',
  '/api/v1/agent/businesses',
  '/api/v1/agent/tools',
  '/api/v1/escrow/templates',
  '/api/v1/payments/recommend-rail',
  '/api/v1/trust/attestation-key',
];

app.use('/api/', (req, res, next) => {
  if (req.method === 'GET' && CACHEABLE_GET_PATHS.some(p => req.path.startsWith(p))) {
    // Cache for 60 seconds on read-heavy public endpoints
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=30');
  }
  next();
});

// Rate limiting on API routes
app.use('/api/', rateLimiter);

// Mutating request audit log
app.use('/api/', (req: any, _res: any, next: any) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const auditLog = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.path,
      userId: req.user?.id || null,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.requestId,
    };
    logger.info(`[AUDIT] ${JSON.stringify(auditLog)}`);
  }
  next();
});

// Health check endpoints
// Typed as the real result, not a hand-copied subset: a literal type here is one
// more list to forget when SchemaCheckResult gains a field, and it fails at
// compile time in app.ts rather than silently dropping the new field from /health.
let lastSchemaCheck: SchemaCheckResult = {
  ok: true,
  checked: 0,
  missing: [],
  notNullable: [],
  wrongType: [],
  target: 'not-yet-checked',
};

export function setSchemaCheckStatus(status: SchemaCheckResult) {
  // Assigned whole, not field by field: rebuilding the object from a hand-written
  // field list would silently drop any field added to SchemaCheckResult later,
  // which is how /health came to omit the drift report in the first place.
  lastSchemaCheck = status;
}

app.get('/health', (_req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Debug config is assembled separately so the final response stays a single
  // object literal — the /health structural tests assert that deploy identity
  // fields are literal properties, not field-by-field assignments.
  const debugInfo: Record<string, unknown> = {};

  // In non-production, include detailed config status for debugging
  if (!isProduction) {
    debugInfo.googleOAuth = !!process.env.GOOGLE_CLIENT_ID;
    debugInfo.emailConfigured = Boolean((process.env.RESEND_API_KEY || '').trim());
    debugInfo.tokenEncryptionConfigured = Boolean((process.env.ENCRYPTION_KEY || '').trim());
    debugInfo.smsConfigured = Boolean(
      (process.env.TWILIO_ACCOUNT_SID || '').trim() &&
        (process.env.TWILIO_AUTH_TOKEN || '').trim() &&
        (process.env.TWILIO_PHONE_NUMBER || '').trim()
    );
    debugInfo.whopConfigured = Boolean((process.env.WHOP_API_KEY || '').trim());
    debugInfo.ptpSigningConfigured = Boolean((process.env.PTP_SIGNING_SECRET || '').trim());
    debugInfo.security = {
      aiGuardActive: true,
      aiProvidersConfigured: Boolean(
        process.env.OPENAI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.DASHSCOPE_API_KEY ||
          process.env.GEMINI_API_KEY ||
          process.env.NVIDIA_API_KEY ||
          process.env.POLLINATIONS_ENABLED === 'true'
      ),
      jevConfigured: Boolean((process.env.TYPESAFE_API_KEY || '').trim()),
      squareConfigured: Boolean((process.env.SQUARE_ACCESS_TOKEN || '').trim()),
      solanaConfigured: Boolean(
        (process.env.SOLANA_RPC_URL || process.env.SOLANA_MERCHANT_WALLET || '').trim()
      ),
      shopifyConfigured: Boolean((process.env.SHOPIFY_API_KEY || '').trim()),
      safepayConfigured: Boolean(
        (process.env.SAFEPAY_WEBHOOK_SECRET || process.env.SAFEPAY_SECRET_KEY || '').trim()
      ),
      offrampConfigured: Boolean((process.env.OFFRAMP__LP_API_KEY || '').trim()),
    };
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    ...debugInfo,
    schema: {
      ok: lastSchemaCheck.ok,
      checked: lastSchemaCheck.checked,
      // The counts alone say "something is wrong"; the names say which migration
      // to run. /health is public, but these are column names and reasons, not
      // credentials — and an operator who can curl the site can already see it
      // is broken.
      missing: lastSchemaCheck.missing,
      notNullable: lastSchemaCheck.notNullable,
      wrongType: lastSchemaCheck.wrongType,
      // Derived from Prisma.dmmf rather than the hand-maintained list above, so a
      // column added to schema.prisma cannot be forgotten here again. drift is
      // capped at 50 entries; driftTruncated says when it was.
      drift: lastSchemaCheck.drift ?? [],
      driftTruncated: lastSchemaCheck.driftTruncated ?? false,
      absentTables: lastSchemaCheck.absentTables ?? 0,
    },
    // The bootstrap is the ONLY thing that creates these tables in production,
    // so "did it run, and did it work?" is the first question whenever the schema
    // check above is red. Without this the answer lived only in the deploy log.
    bootstrap: getBootstrapStatus(),
    deployVersion: process.env.RENDER_GIT_COMMIT || 'unknown',
    commitSha: process.env.RENDER_GIT_COMMIT || null,
    startedAt: process.env.PABANDI_STARTED_AT || null,
  });
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// MCP Streamable HTTP endpoint (JSON-RPC 2.0, POST only)
app.use('/mcp', mcpRouter);

// Mount Central Domain Router
app.use(`/api/${API_VERSION}`, apiRouter);
if (API_VERSION !== 'v1') {
  app.use('/api/v1', apiRouter);
}

// Static SDK & public assets
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'src', 'public');
const SPA_DIR = path.join(PUBLIC_DIR, 'app');
const SPA_INDEX = path.join(SPA_DIR, 'index.html');

app.use('/sdk', express.static(PUBLIC_DIR));
app.use('/assets', express.static(path.join(SPA_DIR, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Internal support admin console (token-protected; API lives under /api/v1/admin/support)
app.get('/support-admin', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(PUBLIC_DIR, 'support-admin.html'));
});
app.get('/support-admin.js', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.sendFile(path.join(PUBLIC_DIR, 'support-admin.js'));
});

app.get('/paid/:publicId', async (req, res) => {
  try {
    const proof = await getPaidProofByPublicId(req.params.publicId);
    if (!proof) {
      res.status(404).type('text/plain').send('Payment proof not found');
      return;
    }
    const esc = (value: unknown) => {
      const entities: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
      };
      return String(value ?? '').replace(/[&<>"']/g, (ch) => entities[ch] || '');
    };
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pabandi Payment Proof</title>
<style>body{margin:0;font:16px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0f14;color:#e6edf3}.card{max-width:640px;margin:40px auto;padding:24px;background:#111827;border:1px solid #1f2937;border-radius:14px}h1{font-size:22px;margin:0 0 8px}.amount{font-size:34px;font-weight:700;color:#3fb950}.row{display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #1f2937}.label{color:#9da7b3}.muted{color:#9da7b3}.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#052e16;color:#3fb950;border:1px solid #144d2a;font-weight:700}</style>
</head><body><div class="card">
<h1>Payment Proof</h1><p class="muted">This is a public proof that a Pabandi booking was paid.</p>
<div class="amount">${esc(proof.amount)} ${esc(proof.currency)}</div>
<span class="badge">${esc(proof.status)}</span>
<div class="row"><span class="label">Worker</span><span>${esc(proof.workerId)}</span></div>
<div class="row"><span class="label">Rail</span><span>${esc(proof.rail || 'escrow release')}</span></div>
<div class="row"><span class="label">Transaction</span><span>${esc(proof.txHash || 'not on-chain')}</span></div>
<div class="row"><span class="label">Receipt ref</span><span>${esc(proof.receiptRef || 'n/a')}</span></div>
<div class="row"><span class="label">Paid at</span><span>${esc(proof.createdAt)}</span></div>
<p class="muted">Verify the escrow state through the Pabandi API. This page does not expose banking details.</p>
</div></body></html>`);
  } catch {
    res.status(500).type('text/plain').send('Could not load payment proof');
  }
});

// LLMs.txt & Agent discovery
app.get('/llms.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.sendFile(path.join(SPA_DIR, 'llms.txt'), (err) => {
    if (err) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send('# PabandiOS\n> The trust operating system for bookings, freight, property, CRM, and finance.\n');
    }
  });
});

// W3C DID Document & OIDC Discovery
app.get('/.well-known/did.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/did+json');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  try {
    const { didService } = require('./services/vc/did.service');
    res.json(didService.getDidDocument());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/.well-known/openid-configuration', (_req, res) => {
  const apiBase = process.env.PUBLIC_API_URL || 'https://pabandi.com';
  res.json({
    issuer: 'https://pabandi.com',
    authorization_endpoint: `${apiBase}/api/v1/oauth/authorize`,
    token_endpoint: `${apiBase}/api/v1/oauth/token`,
    userinfo_endpoint: `${apiBase}/api/v1/oauth/userinfo`,
    jwks_uri: 'https://pabandi.com/.well-known/jwks.json',
    introspection_endpoint: `${apiBase}/api/v1/oauth/introspect`,
    revocation_endpoint: `${apiBase}/api/v1/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'client_credentials', 'refresh_token', 'siws'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
    scopes_supported: ['openid', 'profile', 'email', 'trust:passport', 'agent:execute', 'agent:lease'],
    claims_supported: [
      'sub',
      'iss',
      'aud',
      'email',
      'name',
      'trust_score',
      'trust_band',
      'principal_type',
      'delegation_max_spend_cents',
      'jkt',
    ],
  });
});

app.get('/.well-known/jwks.json', (_req, res) => {
  try {
    const { getJwks } = require('./utils/iamKeys');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(getJwks());
  } catch {
    res.json({ keys: [] });
  }
});

app.use('/.well-known', wellknownRouter);

// Agent Discovery canonical routes
try {
  const discoveryRoutes = require('./routes/discovery.routes');
  app.use(discoveryRoutes.default || discoveryRoutes);
} catch {
  // Optional
}

// React SPA fallback for client-side routing
app.use((req: Request, res: Response, next: NextFunction) => {
  const isHashedAsset = req.path.startsWith('/assets/') || req.path.startsWith('/images/');
  if (req.method === 'GET' && !isHashedAsset) {
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

app.use(express.static(SPA_DIR));

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== 'GET') return next();
  const p = req.path;
  if (
    p.startsWith('/api') ||
    p.startsWith('/sdk') ||
    p.startsWith('/health') ||
    p.startsWith('/mcp') ||
    p.startsWith('/well-known') ||
    p.startsWith('/.well-known') ||
    p.startsWith('/shopify') ||
    p.startsWith('/assets') ||
    p.startsWith('/images') ||
    p === '/manifest.webmanifest' ||
    p === '/robots.txt' ||
    p === '/sitemap.xml' ||
    p === '/llms.txt'
  ) {
    return next();
  }
  if (p === '/sw.js' || p === '/service-worker.js') {
    return res.status(404).type('text/plain').send('Not found');
  }
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(SPA_INDEX, (err: any) => {
    if (err) next();
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

// Initialize data retention cron (non-blocking)
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_RETENTION_CRON === 'true') {
  initializeDataRetention().catch((err) => {
    logger.error('Failed to initialize data retention cron:', err);
  });
}

export default app;
