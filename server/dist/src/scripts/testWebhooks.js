"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const database_1 = require("../utils/database");
const trustScore_service_1 = require("../services/trustScore.service");
const logger_1 = require("../utils/logger");
const crypto_1 = __importDefault(require("crypto"));
async function runTest() {
    logger_1.logger.info('🚀 Starting OAuth Webhooks E2E Test...');
    // 1. Setup Dummy User with high score
    const user = await database_1.prisma.user.create({
        data: {
            email: `webhooktest-${Date.now()}@example.com`,
            passwordHash: 'dummy',
            firstName: 'Webhook',
            lastName: 'Tester',
            trustScore: 95
        }
    });
    // 2. Setup Dummy 3rd Party OAuth Client WITH Webhook configuration
    const webhookSecret = crypto_1.default.randomBytes(16).toString('hex');
    const oauthClient = await database_1.prisma.oAuthClient.create({
        data: {
            clientId: `client_${crypto_1.default.randomBytes(8).toString('hex')}`,
            clientSecret: 'secret',
            name: 'Real Estate Platform',
            redirectUris: ['https://realestate.example.com/oauth/callback'],
            webhookUrl: 'https://webhook.site/pabandi-test-webhook', // Use webhook.site or mock endpoint
            webhookSecret
        }
    });
    // 3. Authorize User (Create an active OAuthToken)
    await database_1.prisma.oAuthToken.create({
        data: {
            accessToken: `token_${crypto_1.default.randomBytes(16).toString('hex')}`,
            clientId: oauthClient.clientId,
            userId: user.id,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        }
    });
    logger_1.logger.info(`✅ Created Mock User & OAuth Client (${oauthClient.name}) with webhook configured.`);
    try {
        // 4. Trigger a Score Drop event
        // The user no-shows a reservation, causing a severe score drop.
        logger_1.logger.info('📉 Simulating a severe negative event (No-Show)...');
        await trustScore_service_1.trustScoreService.processEvent(user.id, {
            component: 'RESERVATION',
            reason: 'User failed to show up for a high-value gig',
            severity: 'negative',
            osintData: {
                breachCount: 2, // Force score drop
                domainAgeDays: 5
            }
        });
        logger_1.logger.info('✅ Event Processed. Check your webhook receiver logs if you supplied a real URL.');
    }
    catch (error) {
        logger_1.logger.error(`❌ Test Failed: ${error.message}`);
    }
    finally {
        // Cleanup
        await database_1.prisma.oAuthToken.deleteMany({ where: { clientId: oauthClient.clientId } });
        await database_1.prisma.oAuthClient.delete({ where: { id: oauthClient.id } });
        await database_1.prisma.user.delete({ where: { id: user.id } });
        logger_1.logger.info('🧹 Cleaned up test data.');
        process.exit(0);
    }
}
runTest();
//# sourceMappingURL=testWebhooks.js.map