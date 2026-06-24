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
import { startDbKeepalive } from './utils/dbKeepalive';
import { initFirebaseAdmin } from './utils/firebase';
import { requireAppCheck } from './middleware/appCheck.middleware';

// Load environment variables FIRST
dotenv.config();
try { dotenv.config({ path: '.env.contracts' }); } catch (err) { logger.warn('.env.contracts not loaded'); }

// Import routes
import authRoutes from './routes/auth.routes';
import whatsappRoutes from './routes/whatsapp.routes';
import businessRoutes from './routes/business.routes';
import reservationRoutes from './routes/reservation.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';
import adminRoutes from './routes/admin.routes';
import webhookRoutes from './routes/webhook.routes';
import cryptoRoutes from './routes/crypto.routes';
import externalRoutes from './routes/external.routes';
import apiClientsRoutes from './routes/apiClients.routes';
import socialRoutes from './routes/social.routes';
import walletRoutes from './routes/wallet.routes';
import waitlistRoutes from './routes/waitlist.routes';
import hospitalityRoutes from './routes/hospitality.routes';

const app = express();
const httpServer = createServer(app);

// Initialize Firebase Admin globally
try { initFirebaseAdmin(); } catch (err) { logger.warn('Firebase init skipped: ' + (err as Error).message); }

// Configure Passport strategies (env vars loaded above)
try { configurePassport(); } catch (err) { logger.warn('Passport init skipped: ' + (err as Error).message); }
app.use(passport.initialize());

// Start DB keepalive to prevent Supabase free-tier pause
try { startDbKeepalive(); } catch (err) { logger.warn('DB keepalive skipped: ' + (err as Error).message); }

const PORT = process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Security and Performance middleware
app.set('trust proxy', 1); // Essential for rate limiting behind Cloud Run
app.use(helmet());
app.use(compression());
const frontendOrigin = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/app\/?$/, '');
app.use(cors({
  origin: [frontendOrigin, 'http://localhost:3000', 'http://localhost:5500', 'https://pabandi-42c5b.web.app'].filter(
    (v, i, a) => v && a.indexOf(v) === i
  ),
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Rate limiting
app.use('/api/', rateLimiter);

// Firebase App Check Middleware for API routes
// Ensure this runs before your actual API routes are registered
// app.use('/api/', requireAppCheck); // TEMPORARILY DISABLED to fix sign in

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    googleOAuth: !!process.env.GOOGLE_CLIENT_ID,
  });
});

// API Routes
app.use(`/api/${API_VERSION}/auth`, authRoutes);
app.use(`/api/${API_VERSION}/businesses`, businessRoutes);
app.use(`/api/${API_VERSION}/reservations`, reservationRoutes);
app.use(`/api/${API_VERSION}/payments`, paymentRoutes);
app.use(`/api/${API_VERSION}/analytics`, analyticsRoutes);
app.use(`/api/${API_VERSION}/admin`, adminRoutes);
app.use(`/api/${API_VERSION}/webhooks`, webhookRoutes);
app.use(`/api/${API_VERSION}/crypto`, cryptoRoutes);
// app.use(`/api/${API_VERSION}/badges`, badgeRoutes);
app.use(`/api/${API_VERSION}/whatsapp`, whatsappRoutes);
app.use(`/api/${API_VERSION}/admin/api-clients`, apiClientsRoutes);

import apiSubscriptionRoutes from './routes/api-subscription.routes';
app.use(`/api/${API_VERSION}/api-subscription`, apiSubscriptionRoutes);

import reliabilityRoutes from './routes/reliability.routes';

import stakingRoutes from './routes/staking.routes';
import airdropRoutes from './routes/airdrop.routes';

import sourcingRoutes from './routes/sourcing.routes';

app.use(`/api/${API_VERSION}/social`, socialRoutes);
app.use(`/api/${API_VERSION}/wallet`, walletRoutes);
app.use(`/api/${API_VERSION}/reliability`, reliabilityRoutes);
app.use(`/api/${API_VERSION}/staking`, stakingRoutes);
app.use(`/api/${API_VERSION}/airdrop`, airdropRoutes);
app.use(`/api/${API_VERSION}/sourcing`, sourcingRoutes);
app.use(`/api/${API_VERSION}/waitlist`, waitlistRoutes);
app.use('/api/waitlist', waitlistRoutes); // Added both for compatibility
app.use(`/api/${API_VERSION}/hospitality`, hospitalityRoutes);
app.use('/api/hospitality', hospitalityRoutes); // Short alias for PMS webhooks

// ── Pabandi Intelligence API (B2B) ──────────────────────────────────────────
// Separate from /api/v1/ so it can be independently rate-limited and versioned
app.use('/external/v1', externalRoutes);

// ── Pabandi Reliability Passport API (Public, API-key gated) ─────────────────
import passportRoutes from './routes/passport.routes';
app.use(`/api/${API_VERSION}/passport`, passportRoutes);

// ── Zero-Knowledge Network API (Shopify/E-Commerce Plugins) ──────────────────
import networkRoutes from './routes/network.routes';
app.use(`/api/${API_VERSION}/network`, networkRoutes);

// ── Omni-Channel Integrations API (TikTok Shop Webhooks, etc) ────────────────
import integrationsRoutes from './routes/integrations.routes';
app.use(`/api/${API_VERSION}/integrations`, integrationsRoutes);

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

// API Documentation
app.get(`/api/${API_VERSION}/docs`, (req, res) => {
  res.json({
    name: 'Pabandi API',
    version: API_VERSION,
    endpoints: {
      auth: `POST /api/${API_VERSION}/auth/register`,
      googleOAuth: `GET /api/${API_VERSION}/auth/google`,
      business: `GET /api/${API_VERSION}/businesses`,
      reservations: `GET /api/${API_VERSION}/reservations`,
    },
  });
});

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to the Pabandi Backend API',
    version: API_VERSION,
    docs: `/api/${API_VERSION}/docs`,
    health: '/health',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const parsedPort = parseInt(process.env.PORT || '5000', 10);
httpServer.listen(parsedPort, '0.0.0.0', () => {
  logger.info(`🚀 Server running on port ${parsedPort}`);
  logger.info(`📚 API available at http://localhost:${parsedPort}/api/${API_VERSION}`);
  logger.info(`🏥 Health check: http://localhost:${parsedPort}/health`);
  logger.info(`🔑 Google OAuth: ${process.env.GOOGLE_CLIENT_ID ? '✅ configured' : '❌ not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;