"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logApiUsage = exports.apiKeyAuth = void 0;
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const errorHandler_1 = require("./errorHandler");
const crypto_1 = __importDefault(require("crypto"));
const TIER_LIMITS = {
    STARTER: 500,
    GROWTH: 10000,
    ENTERPRISE: 100000,
};
function hashApiKey(key) {
    return crypto_1.default.createHash('sha256').update(key).digest('hex');
}
/**
 * Validates the x-api-key header, enforces quota, and attaches
 * the resolved ApiClient to req.apiClient.
 */
const apiKeyAuth = async (req, res, next) => {
    req.requestStartTime = Date.now();
    let apiKey = req.headers['x-api-key'];
    if (!apiKey) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            apiKey = authHeader.slice(7).trim();
        }
    }
    if (!apiKey) {
        return next(new errorHandler_1.CustomError('Missing API key. Provide via x-api-key header or Authorization: Bearer <key>', 401));
    }
    const keyHash = hashApiKey(apiKey);
    try {
        const client = await database_1.prisma.apiClient.findUnique({
            where: { apiKeyHash: keyHash },
            select: {
                id: true,
                name: true,
                email: true,
                tier: true,
                callsUsed: true,
                callsLimit: true,
                isActive: true,
                businessId: true,
            },
        });
        if (!client) {
            // Agent keys issued by POST /api/v1/agents/register are stored on
            // AgentMarketplace, not ApiClient. Accept them here so the one-curl
            // signup checklist actually authenticates.
            const agents = (await database_1.prisma.$queryRaw `
        SELECT id, name, "ownerEmail", status
        FROM "AgentMarketplace"
        WHERE "apiKeyHash" = ${keyHash} AND status = 'active'
        LIMIT 1
      `);
            if (agents.length > 0) {
                const agent = agents[0];
                req.apiClient = {
                    id: agent.id,
                    name: agent.name,
                    email: agent.ownerEmail,
                    tier: 'STARTER',
                    callsUsed: 0,
                    callsLimit: TIER_LIMITS.STARTER,
                    businessId: null,
                    isAgent: true,
                };
                return next();
            }
            return next(new errorHandler_1.CustomError('Invalid API key', 401));
        }
        if (!client.isActive) {
            return next(new errorHandler_1.CustomError('API key has been revoked', 403));
        }
        // Enforce hard quota cap (Starter tier) or soft cap with overage for paid tiers
        const hardCapTiers = ['STARTER'];
        if (hardCapTiers.includes(client.tier) && client.callsUsed >= client.callsLimit) {
            return next(new errorHandler_1.CustomError(`Monthly quota exhausted (${client.callsLimit} calls). Upgrade your plan at pabandi.com/developer`, 429));
        }
        req.apiClient = {
            id: client.id,
            name: client.name,
            email: client.email,
            tier: client.tier,
            callsUsed: client.callsUsed,
            callsLimit: client.callsLimit,
            businessId: client.businessId,
        };
        next();
    }
    catch (error) {
        logger_1.logger.error('API key validation error:', error);
        next(error);
    }
};
exports.apiKeyAuth = apiKeyAuth;
/**
 * Records the API call in ApiUsageLog and increments callsUsed.
 * Must be used AFTER the response is sent (via res.on('finish')).
 */
const logApiUsage = (req, res, next) => {
    res.on('finish', () => {
        if (!req.apiClient)
            return;
        // Agent signup keys are not ApiClient rows — skip ApiUsageLog bookkeeping.
        if (req.apiClient.isAgent)
            return;
        const latencyMs = Date.now() - (req.requestStartTime ?? Date.now());
        const clientId = req.apiClient.id;
        const endpoint = req.path;
        const statusCode = res.statusCode;
        // Basic pricing tier configuration
        const ENDPOINT_PRICING = {
            '/score': { fiat: 0.05, crypto: 2.5 },
            '/business': { fiat: 0.01, crypto: 0.5 },
            'default': { fiat: 0.01, crypto: 0.5 }
        };
        const pathBase = endpoint.split('/')[1] ? `/${endpoint.split('/')[1]}` : 'default';
        const pricing = ENDPOINT_PRICING[pathBase] || ENDPOINT_PRICING['default'];
        // Fire-and-forget — do not block the response
        Promise.all([
            database_1.prisma.apiUsageLog.create({
                data: {
                    clientId,
                    endpoint,
                    statusCode,
                    latencyMs,
                    costFiat: pricing.fiat,
                    costCrypto: pricing.crypto
                },
            }),
            database_1.prisma.apiClient.update({
                where: { id: clientId },
                data: { callsUsed: { increment: 1 } },
            }),
        ]).catch((err) => logger_1.logger.error('Failed to log API usage:', err));
    });
    next();
};
exports.logApiUsage = logApiUsage;
//# sourceMappingURL=apiKey.middleware.js.map