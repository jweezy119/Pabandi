import { prisma } from '../utils/database';
import { agentIdentityService } from '../services/agent-identity.service';
import { logger } from '../utils/logger';

export async function syncAgentReputation() {
  try {
    logger.info('[SyncReputation] Starting reputation sync...');

    const passports = await prisma.trustPassport.findMany({
      where: {
        onchainIdentityRegistered: true,
        onchainAgentId: { not: null },
      },
    });

    let synced = 0;
    let failed = 0;

    for (const passport of passports) {
      try {
        const success = await agentIdentityService.syncReputation(passport.id);
        if (success) {
          synced++;
        } else {
          failed++;
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        logger.error(`[SyncReputation] Failed to sync ${passport.handle}:`, error);
        failed++;
      }
    }

    logger.info(`[SyncReputation] Completed. Synced: ${synced}, Failed: ${failed}`);
    return { synced, failed };
  } catch (error) {
    logger.error('[SyncReputation] Error:', error);
    throw error;
  }
}

if (require.main === module) {
  syncAgentReputation()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
