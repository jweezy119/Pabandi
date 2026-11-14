import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import compression from 'compression';
import path from 'path';

import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { requestIdMiddleware } from './middleware/requestId.middleware';
import { apiRouter } from './routes/index';

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
        scriptSrc: ["'self'", 'https://maps.googleapis.com'],
        styleSrc: ["'self'", 'https://fonts.googleapis.com', "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          'https://images.unsplash.com',
          'https://maps.gstatic.com',
          'https://maps.googleapis.com',
          'https://lh3.googleusercontent.com',
          'https://cryptologos.cc',
          'https://*.tile.openstreetmap.org',
          'https://*.openstreetmap.org',
          'https://cdnjs.cloudflare.com',
          'https://pabandi.onrender.com',
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

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
let lastSchemaCheck: { ok: boolean; checked: number } = { ok: true, checked: 6 };

export function setSchemaCheckStatus(status: { ok: boolean; checked: number }) {
  lastSchemaCheck = status;
}

app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
    emailConfigured: Boolean((process.env.RESEND_API_KEY || '').trim()),
    tokenEncryptionConfigured: Boolean((process.env.ENCRYPTION_KEY || '').trim()),
    smsConfigured: Boolean(
      (process.env.TWILIO_ACCOUNT_SID || '').trim() &&
        (process.env.TWILIO_AUTH_TOKEN || '').trim() &&
        (process.env.TWILIO_PHONE_NUMBER || '').trim()
    ),
    whopConfigured: Boolean((process.env.WHOP_API_KEY || '').trim()),
    ptpSigningConfigured: Boolean((process.env.PTP_SIGNING_SECRET || '').trim()),
    security: {
      aiGuardActive: true,
      aiProvidersConfigured: Boolean(
        process.env.OPENAI_API_KEY ||
          process.env.ANTHROPIC_API_KEY ||
          process.env.DASHSCOPE_API_KEY ||
          process.env.GEMINI_API_KEY
      ),
      squareConfigured: Boolean((process.env.SQUARE_ACCESS_TOKEN || '').trim()),
      solanaConfigured: Boolean(
        (process.env.SOLANA_RPC_URL || process.env.SOLANA_MERCHANT_WALLET || '').trim()
      ),
      shopifyConfigured: Boolean((process.env.SHOPIFY_API_KEY || '').trim()),
      safepayConfigured: Boolean(
        (process.env.SAFEPAY_WEBHOOK_SECRET || process.env.SAFEPAY_SECRET_KEY || '').trim()
      ),
      offrampConfigured: Boolean((process.env.OFFRAMP__LP_API_KEY || '').trim()),
    },
    schema: {
      ok: lastSchemaCheck.ok,
      checked: lastSchemaCheck.checked,
    },
    deployVersion: process.env.RENDER_GIT_COMMIT || 'unknown',
    commitSha: process.env.RENDER_GIT_COMMIT || null,
    startedAt: process.env.PABANDI_STARTED_AT || null,
  });
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

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

export default app;
