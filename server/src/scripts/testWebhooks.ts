import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../utils/database';
import { trustScoreService } from '../services/trustScore.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';

async function runTest() {
  logger.info('🚀 Starting OAuth Webhooks E2E Test...');

  // 1. Setup Dummy User with high score
  const user = await prisma.user.create({
    data: {
      email: `webhooktest-${Date.now()}@example.com`,
      passwordHash: 'dummy',
      firstName: 'Webhook',
      lastName: 'Tester',
      trustScore: 95
    }
  });

  // 2. Setup Dummy 3rd Party OAuth Client WITH Webhook configuration
  const webhookSecret = crypto.randomBytes(16).toString('hex');
  const oauthClient = await prisma.oAuthClient.create({
    data: {
      clientId: `client_${crypto.randomBytes(8).toString('hex')}`,
      clientSecret: 'secret',
      name: 'Real Estate Platform',
      redirectUris: ['https://realestate.example.com/oauth/callback'],
      webhookUrl: 'https://webhook.site/pabandi-test-webhook', // Use webhook.site or mock endpoint
      webhookSecret
    }
  });

  // 3. Authorize User (Create an active OAuthToken)
  await prisma.oAuthToken.create({
    data: {
      accessToken: `token_${crypto.randomBytes(16).toString('hex')}`,
      clientId: oauthClient.clientId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  });

  logger.info(`✅ Created Mock User & OAuth Client (${oauthClient.name}) with webhook configured.`);

  try {
    // 4. Trigger a Score Drop event
    // The user no-shows a reservation, causing a severe score drop.
    logger.info('📉 Simulating a severe negative event (No-Show)...');
    
    await trustScoreService.processEvent(user.id, {
      component: 'RESERVATION',
      reason: 'User failed to show up for a high-value gig',
      severity: 'negative',
      osintData: {
        breachCount: 2, // Force score drop
        domainAgeDays: 5
      }
    });

    logger.info('✅ Event Processed. Check your webhook receiver logs if you supplied a real URL.');

  } catch (error: any) {
    logger.error(`❌ Test Failed: ${error.message}`);
  } finally {
    // Cleanup
    await prisma.oAuthToken.deleteMany({ where: { clientId: oauthClient.clientId } });
    await prisma.oAuthClient.delete({ where: { id: oauthClient.id } });
    await prisma.user.delete({ where: { id: user.id } });
    logger.info('🧹 Cleaned up test data.');
    process.exit(0);
  }
}

runTest();
