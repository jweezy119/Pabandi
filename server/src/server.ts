import { createServer } from 'http';
import { app, setSchemaCheckStatus } from './app';
import { logger } from './utils/logger';
import { logSchemaCheck } from './services/schema-check.service';
import { initializeTrustCore } from './services/trust-core.service';
import { eventBus } from './services/event-bus.service';
import { scanOverdueInvoices } from './services/invoice.service';
import cron from 'node-cron';
import { syncAllChannels } from './services/channelSync.service';

const PORT = process.env.PORT || (process.env.NODE_ENV === 'production' ? 8080 : 5000);
const parsedPort = typeof PORT === 'string' ? parseInt(PORT, 10) : PORT;

const httpServer = createServer(app);

// Startup sanity check in production
if (process.env.NODE_ENV === 'production') {
  const missing: string[] = [];
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) missing.push('JWT_SECRET (min 16 chars)');
  // PTP is intentionally NOT a boot requirement: ptp.spec.ts checks the secret
  // where it is used, so a missing value gives agent attestations a clear 503
  // while human auth, discovery and every unrelated route keep working. Killing
  // the whole API here turned one optional integration secret into a total outage.
  if (!process.env.PTP_SIGNING_SECRET) {
    logger.warn('PTP_SIGNING_SECRET not set — agent attestation signing/verification is disabled until configured');
  }
  if (!process.env.ENCRYPTION_KEY) missing.push('ENCRYPTION_KEY');
  if (!process.env.TELEGRAM_BOT_SECRET && !process.env.TELEGRAM_WEBHOOK_SECRET) missing.push('TELEGRAM_BOT_SECRET');
  if (missing.length > 0) {
    logger.error(`🚨 FATAL: Server starting with missing production env configuration:\n${missing.map(m => ` - ${m}`).join('\n')}`);
    throw new Error(`Fatal startup configuration error: missing required environment variables: ${missing.join(', ')}`);
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

  // Table bootstrap FIRST, then the schema self-check.
  //
  // Order matters. The bootstrap is what actually creates these tables in
  // production, so a check that runs before it reports a failure the boot then
  // fixes — and /health serves that stale failure for up to ten minutes. That is
  // exactly the window that made a real outage look like a fixed one.
  setImmediate(async () => {
    try {
      const { ensureAgentTables } = await import('./utils/tableBootstrap');
      await ensureAgentTables();
    } catch {
      // Optional — the schema check below reports precisely what is missing.
    }

    void logSchemaCheck().then((result) => {
      setSchemaCheckStatus(result);
    });
    setInterval(() => {
      void logSchemaCheck().then((result) => {
        setSchemaCheckStatus(result);
      });
    }, 10 * 60 * 1000).unref();
  });

  // Background Crons
  try {
    // Inbound email/calendar sync. Opt-in because it needs provider credentials.
    if (process.env.ENABLE_CHANNEL_SYNC === 'true') {
      const runSync = () => void syncAllChannels();
      setTimeout(runSync, 15_000).unref();
      setInterval(runSync, 5 * 60 * 1000).unref();
      logger.info('[ChannelSync] scheduled every 5 minutes');
    }

    // Invoice overdue check
    cron.schedule('0 9 * * *', async () => {
      try {
        await scanOverdueInvoices();
      } catch (e: any) {
        logger.error('[InvoiceCron] Error:', e.message);
      }
    });
  } catch (err: any) {
    logger.warn(`Cron initialization warning: ${err?.message ?? err}`);
  }
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
