import cron from 'node-cron';
import { prisma } from './database';
import { logger } from './logger';
import { rentAutomationService } from '../services/rentAutomation.service';

// Every 4 days at 03:00 AM
// Using a variable avoids ts-node misreading "* /" as a comment closer
const EVERY_4_DAYS = ['0', '3', '*', '*', '*'].join(' ').replace('* *', '*/4 *');

export function startDbKeepalive() {
  // Fire-and-forget: never block server startup on DB keepalive
  pingDatabase('startup').catch((err) => {
    logger.warn('[Keepalive] Startup DB ping skipped: ' + (err?.message || err));
  });

  cron.schedule(EVERY_4_DAYS, () => {
    pingDatabase('scheduled').catch((err) => {
      logger.warn('[Keepalive] Scheduled DB ping failed: ' + (err?.message || err));
    });
  });

  // Daily rent automation at 04:00 AM
  cron.schedule('0 4 * * *', () => {
    rentAutomationService.runDailyRentAutomation().then((result) => {
      logger.info('[RentAutomation] Daily run completed', result);
    }).catch((err) => {
      logger.error('[RentAutomation] Daily run failed', err);
    });
  });

  logger.info('[Keepalive] DB keepalive scheduled - runs every 4 days');
}

async function pingDatabase(reason: string) {
  try {
    const count = await prisma.user.count();
    logger.info('[Keepalive] DB ping OK [' + reason + '] - ' + count + ' users');
  } catch (err: any) {
    logger.error('[Keepalive] DB ping FAILED [' + reason + ']: ' + (err && err.message));
  }
}
