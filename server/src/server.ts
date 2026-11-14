import { createServer } from 'http';
import { app, setSchemaCheckStatus } from './app';
import { logger } from './utils/logger';
import { logSchemaCheck } from './services/schema-check.service';
import { initializeTrustCore } from './services/trust-core.service';
import { eventBus } from './services/event-bus.service';
import { jobCronService } from './services/jobCronService';
import { subscriptionReconcileCron } from './services/subscriptionReconcileCron.service';
import { startAlertSweep } from './services/alertSweep.service';
import { scanOverdueInvoices } from './services/invoice.service';
import { scanFailureOwnership } from './services/failure-ownership.service';
import { startGigRefreshCron } from './scripts/seed-gigs';
import cron from 'node-cron';

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 5000);
const parsedPort = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

const httpServer = createServer(app);

// Startup sanity check in production
if (process.env.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) missing.push('JWT_SECRET (min 16 chars)');
  if (!process.env.PTP_SIGNING_SECRET) missing.push('PTP_SIGNING_SECRET');
  if (!process.env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');
  if (missing.length > 0) {
    logger.error(`🚨 Server starting with missing production env configuration:\n${missing.map(m => ` - ${m}`).join('\n')}`);
  }
}

// Global safety nets
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection (process kept alive):', reason?.message ?? reason);
});
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught exception (process kept alive):', err?.message ?? err);
});

// Boot HTTP server
httpServer.listen(parsedPort, '0.0.0.0', async () => {
  logger.info(`🚀 Server running on port ${parsedPort}`);
  logger.info(`🏥 Health check: http://localhost:${parsedPort}/health`);

  // Initialize TrustCore event pipeline & replay outbox
  try {
    initializeTrustCore();
    void eventBus.replayOutbox().then((n) => {
      if (n > 0) logger.info(`✅ Replayed ${n} trust outbox deliveries`);
    });
  } catch (err: any) {
    logger.warn(`TrustCore initialization skipped: ${err?.message ?? err}`);
  }

  // Schema self-check
  void logSchemaCheck().then((result) => {
    setSchemaCheckStatus({ ok: result.ok, checked: result.checked });
  });
  setInterval(() => {
    void logSchemaCheck().then((result) => {
      setSchemaCheckStatus({ ok: result.ok, checked: result.checked });
    });
  }, 10 * 60 * 1000).unref();

  // Background Crons
  try {
    jobCronService.start();
    subscriptionReconcileCron.start();
    startAlertSweep();
    startGigRefreshCron();

    // Invoice overdue check
    cron.schedule('0 9 * * *', async () => {
      try {
        await scanOverdueInvoices();
      } catch (e: any) {
        logger.error('[InvoiceCron] Error:', e.message);
      }
    });

    // Failure ownership check
    cron.schedule('0 10 * * *', async () => {
      try {
        await scanFailureOwnership();
      } catch (e: any) {
        logger.error('[FailureOwnership] Error:', e.message);
      }
    });
  } catch (err: any) {
    logger.warn(`Cron initialization warning: ${err?.message ?? err}`);
  }

  // Table bootstrap
  setImmediate(async () => {
    try {
      const { ensureAgentTables } = await import('./utils/tableBootstrap');
      await ensureAgentTables();
    } catch {
      // Optional
    }
  });
});

// Graceful shutdown
const handleShutdown = async () => {
  logger.info('Closing HTTP server gracefully...');
  httpServer.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', handleShutdown);
process.on('SIGINT', handleShutdown);

export default httpServer;
