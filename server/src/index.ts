// Pabandi Server
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import passport from 'passport';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { configurePassport } from './utils/passport';
import { startDbKeepalive } from './utils/dbKeepalive';

// Load environment variables FIRST
dotenv.config();

// Import routes
import authRoutes from './routes/auth.routes';
import businessRoutes from './routes/business.routes';
import reservationRoutes from './routes/reservation.routes';
import paymentRoutes from './routes/payment.routes';
import analyticsRoutes from './routes/analytics.routes';

const app = express();
const httpServer = createServer(app);

// Configure Passport strategies (env vars loaded above)
configurePassport();
app.use(passport.initialize());

// Start DB keepalive to prevent Supabase free-tier pause
startDbKeepalive();

const PORT = process.env.PORT || 5000;
const API_VERSION = process.env.API_VERSION || 'v1';

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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
httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📚 API available at http://localhost:${PORT}/api/${API_VERSION}`);
  logger.info(`🏥 Health check: http://localhost:${PORT}/health`);
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