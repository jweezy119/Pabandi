"use strict";
/**
 * privy.service.ts — Server-side Privy integration
 *
 * Handles:
 * - Organization wallet creation via Privy API
 * - Webhook signature verification
 * - Gas sponsorship requests
 * - Wallet balance lookup
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOrgWallet = createOrgWallet;
exports.verifyPrivyWebhook = verifyPrivyWebhook;
exports.sponsorGas = sponsorGas;
exports.getWalletBalance = getWalletBalance;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const PRIVY_API_BASE = 'https://api.privy.io/v1';
if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    logger_1.logger.warn('PRIVY_APP_ID or PRIVY_APP_SECRET not configured — Privy server features disabled');
}
/**
 * Create an organization wallet via Privy API.
 * Returns the wallet address and Privy wallet ID.
 */
async function createOrgWallet(payload) {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error('Privy credentials not configured');
    }
    try {
        const resp = await axios_1.default.post(`${PRIVY_API_BASE}/organizations/${payload.organizationId}/wallets`, {
            chain: payload.chain || 'solana',
            organization_name: payload.organizationName,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PRIVY_APP_SECRET}`,
                'Privy-Application-Id': PRIVY_APP_ID,
            },
        });
        const wallet = {
            id: resp.data.data.id,
            address: resp.data.data.address,
            chain: resp.data.data.chain,
            status: resp.data.data.status,
            organizationId: payload.organizationId,
            createdAt: resp.data.data.created_at,
        };
        logger_1.logger.info(`[Privy] Org wallet created: ${wallet.address} for org ${payload.organizationId}`);
        return wallet;
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Failed to create org wallet: ${err.message}`);
        throw err;
    }
}
/**
 * Verify a Privy webhook signature.
 * Returns true if the webhook is authentic.
 */
async function verifyPrivyWebhook(body, signature, timestamp) {
    if (!PRIVY_APP_SECRET)
        return false;
    try {
        // Privy uses HMAC-SHA256 with the app secret
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const expectedSignature = crypto
            .createHmac('sha256', PRIVY_APP_SECRET)
            .update(`${timestamp}.${body.toString()}`)
            .digest('hex');
        return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Webhook verification failed: ${err}`);
        return false;
    }
}
/**
 * Sponsor gas for a wallet via Privy API.
 */
async function sponsorGas(walletAddress, chain = 'solana') {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error('Privy credentials not configured');
    }
    try {
        const resp = await axios_1.default.post(`${PRIVY_API_BASE}/sponsorship`, {
            wallet_address: walletAddress,
            chain,
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PRIVY_APP_SECRET}`,
                'Privy-Application-Id': PRIVY_APP_ID,
            },
        });
        return { success: true, txHash: resp.data.data?.txHash };
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Gas sponsorship failed: ${err.message}`);
        throw err;
    }
}
/**
 * Get wallet balance via Privy API.
 */
async function getWalletBalance(walletAddress, chain = 'solana') {
    if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
        throw new Error('Privy credentials not configured');
    }
    try {
        const resp = await axios_1.default.get(`${PRIVY_API_BASE}/wallets/${walletAddress}/balance`, {
            params: { chain },
            headers: {
                'Authorization': `Bearer ${PRIVY_APP_SECRET}`,
                'Privy-Application-Id': PRIVY_APP_ID,
            },
        });
        return { balance: resp.data.data.balance, unit: resp.data.data.unit };
    }
    catch (err) {
        logger_1.logger.error(`[Privy] Failed to get wallet balance: ${err.message}`);
        throw err;
    }
}
//# sourceMappingURL=privy.service.js.map