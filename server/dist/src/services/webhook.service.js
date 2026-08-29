"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
class WebhookService {
    constructor() {
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY_MS = 2000;
    }
    /**
     * Dispatches a webhook event to all subscribed active endpoints for a business.
     * @param eventName - The name of the event (e.g., 'reservation.created')
     * @param businessId - The business ID
     * @param payload - The data payload to send
     */
    async dispatch(eventName, businessId, payload) {
        try {
            // Find all active endpoints for this business
            const endpoints = await database_1.prisma.webhookEndpoint.findMany({
                where: {
                    businessId,
                    isActive: true,
                },
            });
            if (!endpoints.length)
                return;
            // Filter endpoints that are subscribed to this event
            const subscribedEndpoints = endpoints.filter((endpoint) => endpoint.subscribedEvents.includes(eventName) || endpoint.subscribedEvents.includes('*'));
            if (!subscribedEndpoints.length)
                return;
            const body = JSON.stringify({
                event: eventName,
                timestamp: new Date().toISOString(),
                data: payload,
            });
            // Dispatch to each subscribed endpoint
            for (const endpoint of subscribedEndpoints) {
                // Run asynchronously without awaiting so we don't block the main flow
                this.sendWithRetry(endpoint, body).catch((error) => {
                    logger_1.logger.error(`Webhook dispatch completely failed for ${endpoint.targetUrl}: ${error.message}`);
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Error initiating webhook dispatch: ${error.message}`);
        }
    }
    async sendWithRetry(endpoint, body, attempt = 1) {
        try {
            // Generate HMAC signature
            const signature = crypto_1.default
                .createHmac('sha256', endpoint.signingSecret)
                .update(body)
                .digest('hex');
            logger_1.logger.info(`Sending webhook event to ${endpoint.targetUrl} (Attempt ${attempt})`);
            await axios_1.default.post(endpoint.targetUrl, body, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-pabandi-signature': signature,
                },
                timeout: 5000, // 5 second timeout per request
            });
            logger_1.logger.info(`Successfully sent webhook to ${endpoint.targetUrl}`);
        }
        catch (error) {
            if (attempt < this.MAX_RETRIES) {
                logger_1.logger.warn(`Webhook delivery to ${endpoint.targetUrl} failed on attempt ${attempt}. Retrying in ${this.RETRY_DELAY_MS}ms. Error: ${error.message}`);
                // Wait before retrying
                await new Promise((resolve) => setTimeout(resolve, this.RETRY_DELAY_MS * attempt)); // Exponential backoff
                return this.sendWithRetry(endpoint, body, attempt + 1);
            }
            else {
                throw new Error(`Max retries reached (${this.MAX_RETRIES}). Final error: ${error.message}`);
            }
        }
    }
    /**
     * Dispatches an event to all OAuth Clients that have an active OAuthToken for the user,
     * provided they have configured a webhookUrl.
     */
    async dispatchToOAuthClients(userId, eventName, payload) {
        try {
            // Find all valid OAuthTokens for this user, including the client info
            const tokens = await database_1.prisma.oAuthToken.findMany({
                where: {
                    userId,
                    revoked: false,
                    expiresAt: { gt: new Date() } // Token not expired
                },
                include: {
                    client: true
                }
            });
            if (!tokens.length)
                return;
            // Extract unique active clients that have a webhook URL
            const uniqueClients = new Map();
            for (const token of tokens) {
                if (token.client.isActive && token.client.webhookUrl && token.client.webhookSecret) {
                    uniqueClients.set(token.client.id, token.client);
                }
            }
            if (uniqueClients.size === 0)
                return;
            const body = JSON.stringify({
                event: eventName,
                timestamp: new Date().toISOString(),
                data: payload,
            });
            // Dispatch to each OAuth Client
            for (const client of Array.from(uniqueClients.values())) {
                this.sendWithRetry({
                    id: 'virtual',
                    targetUrl: client.webhookUrl,
                    signingSecret: client.webhookSecret,
                    businessId: '',
                    subscribedEvents: [],
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                }, body).catch((error) => {
                    logger_1.logger.error(`OAuth Webhook dispatch failed for ${client.name} (${client.webhookUrl}): ${error.message}`);
                });
            }
        }
        catch (error) {
            logger_1.logger.error(`Error initiating OAuth webhook dispatch: ${error.message}`);
        }
    }
}
exports.webhookService = new WebhookService();
//# sourceMappingURL=webhook.service.js.map