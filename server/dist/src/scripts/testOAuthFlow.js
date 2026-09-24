"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("../utils/database");
const oauth_service_1 = require("../services/oauth.service");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
async function runTest() {
    logger_1.logger.info('🚀 Starting OAuth Delegated Access E2E Test...');
    // 1. Setup Dummy User and Passport
    const user = await database_1.prisma.user.create({
        data: {
            email: `testuser-${Date.now()}@example.com`,
            passwordHash: 'dummy',
            firstName: 'Jane',
            lastName: 'Doe',
            trustScore: 850
        }
    });
    await database_1.prisma.trustPassport.create({
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
    const clientSecret = crypto_1.default.randomBytes(16).toString('hex');
    const oauthClient = await database_1.prisma.oAuthClient.create({
        data: {
            clientId: `client_${crypto_1.default.randomBytes(8).toString('hex')}`,
            clientSecret,
            name: 'Rozee Jobs',
            redirectUris: ['https://rozee.example.com/oauth/callback']
        }
    });
    logger_1.logger.info(`✅ Created Mock User & OAuth Client (${oauthClient.name})`);
    try {
        // 3. Step 1: Authorization Request (Frontend validation)
        const validClient = await oauth_service_1.oauthService.validateClientAndRedirect(oauthClient.clientId, oauthClient.redirectUris[0]);
        logger_1.logger.info(`✅ Validated Client Request: ${validClient.name}`);
        // 4. Step 2: User Consents (Generates Auth Code)
        const authCode = await oauth_service_1.oauthService.generateAuthorizationCode(oauthClient.clientId, user.id, oauthClient.redirectUris[0]);
        logger_1.logger.info(`✅ User Approved. Generated Auth Code: ${authCode.substring(0, 10)}...`);
        // 5. Step 3: Back-channel Token Exchange
        const tokens = await oauth_service_1.oauthService.exchangeCodeForToken(oauthClient.clientId, clientSecret, authCode, oauthClient.redirectUris[0]);
        logger_1.logger.info(`✅ Exchanged Code for Tokens. Access Token: ${tokens.access_token.substring(0, 10)}...`);
        // 6. Step 4: 3rd Party fetches UserInfo using Access Token
        const userInfo = await oauth_service_1.oauthService.getUserInfo(tokens.access_token);
        logger_1.logger.info('✅ Successfully fetched UserInfo via API:');
        console.log(JSON.stringify(userInfo, null, 2));
    }
    catch (error) {
        logger_1.logger.error(`❌ Test Failed: ${error.message}`);
    }
    finally {
        // Cleanup
        await database_1.prisma.oAuthClient.delete({ where: { id: oauthClient.id } });
        await database_1.prisma.user.delete({ where: { id: user.id } });
        logger_1.logger.info('🧹 Cleaned up test data.');
        process.exit(0);
    }
}
runTest();
//# sourceMappingURL=testOAuthFlow.js.map