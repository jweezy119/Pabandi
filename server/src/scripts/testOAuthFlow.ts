import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../utils/database';
import { oauthService } from '../services/oauth.service';
import { logger } from '../utils/logger';
import crypto from 'crypto';

async function runTest() {
  logger.info('🚀 Starting OAuth Delegated Access E2E Test...');

  // 1. Setup Dummy User and Passport
  const user = await prisma.user.create({
    data: {
      email: `testuser-${Date.now()}@example.com`,
      passwordHash: 'dummy',
      firstName: 'Jane',
      lastName: 'Doe',
      trustScore: 850
    }
  });

  await prisma.trustPassport.create({
    data: {
      providerRef: user.id,
      handle: `jane-doe-${Date.now()}`,
      category: 'FREELANCER',
      displayName: 'Jane Doe',
      riskScore: 850,
      visibility: 'PUBLIC'
    }
  });

  // 2. Setup Dummy 3rd Party OAuth Client (e.g. Rozee.pk)
  const clientSecret = crypto.randomBytes(16).toString('hex');
  const oauthClient = await prisma.oAuthClient.create({
    data: {
      clientId: `client_${crypto.randomBytes(8).toString('hex')}`,
      clientSecret,
      name: 'Rozee Jobs',
      redirectUris: ['https://rozee.example.com/oauth/callback']
    }
  });

  logger.info(`✅ Created Mock User & OAuth Client (${oauthClient.name})`);

  try {
    // 3. Step 1: Authorization Request (Frontend validation)
    const validClient = await oauthService.validateClientAndRedirect(
      oauthClient.clientId, 
      oauthClient.redirectUris[0]
    );
    logger.info(`✅ Validated Client Request: ${validClient.name}`);

    // 4. Step 2: User Consents (Generates Auth Code)
    const authCode = await oauthService.generateAuthorizationCode(
      oauthClient.clientId,
      user.id,
      oauthClient.redirectUris[0]
    );
    logger.info(`✅ User Approved. Generated Auth Code: ${authCode.substring(0, 10)}...`);

    // 5. Step 3: Back-channel Token Exchange
    const tokens = await oauthService.exchangeCodeForToken(
      oauthClient.clientId,
      clientSecret,
      authCode,
      oauthClient.redirectUris[0]
    );
    logger.info(`✅ Exchanged Code for Tokens. Access Token: ${tokens.access_token.substring(0, 10)}...`);

    // 6. Step 4: 3rd Party fetches UserInfo using Access Token
    const userInfo = await oauthService.getUserInfo(tokens.access_token);
    logger.info('✅ Successfully fetched UserInfo via API:');
    console.log(JSON.stringify(userInfo, null, 2));

  } catch (error: any) {
    logger.error(`❌ Test Failed: ${error.message}`);
  } finally {
    // Cleanup
    await prisma.oAuthClient.delete({ where: { id: oauthClient.id } });
    await prisma.user.delete({ where: { id: user.id } });
    logger.info('🧹 Cleaned up test data.');
    process.exit(0);
  }
}

runTest();
