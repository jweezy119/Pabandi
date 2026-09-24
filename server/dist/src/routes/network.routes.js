"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const network_service_1 = require("../services/network.service");
const crypto_service_1 = require("../services/crypto.service");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const logger_1 = require("../utils/logger");
const discovery_controller_1 = require("../controllers/discovery.controller");
// Lazy-load to avoid runtime crash when bloom-filters is not installed
let _bloomFilterService = null;
async function getBloomFilterService() {
    if (_bloomFilterService)
        return _bloomFilterService;
    try {
        const mod = await Promise.resolve().then(() => __importStar(require('../services/bloomFilter.service')));
        _bloomFilterService = mod.bloomFilterService;
        return _bloomFilterService;
    }
    catch {
        return null;
    }
}
const router = (0, express_1.Router)();
/**
 * ── PUBLIC KEY EXCHANGE & FILTER ──────────────────────────────────────────
 * Allows the browser SDK to fetch the daily HMAC salt and the Bloom Filter.
 */
router.get('/public-salt', (req, res) => {
    res.json({ salt: crypto_service_1.cryptoService.getPublicSalt() });
});
router.get('/bloom-filter', async (req, res) => {
    const svc = await getBloomFilterService();
    if (!svc)
        return res.status(503).json({ error: 'Bloom filter service unavailable' });
    res.json({ filter: svc.getSerializedFilter() });
});
// Protect all network routes with B2B API Key validation
router.use(apiKey_middleware_1.apiKeyAuth);
router.use(apiKey_middleware_1.logApiUsage);
/**
 * POST /api/v1/network/check-hash
 *
 * Check a hashed identity against the zero-knowledge blocklist.
 * Used by e-commerce checkout flows (e.g. Shopify plugins) to decide whether to hide COD.
 */
router.post('/check-hash', rateLimit_middleware_1.strictApiLimiter, async (req, res) => {
    try {
        const { hash } = req.body;
        if (!hash || typeof hash !== 'string' || hash.length !== 64) {
            return res.status(400).json({
                success: false,
                error: 'Invalid hash. Must be a 64-character SHA256 string.',
            });
        }
        const result = await network_service_1.networkService.checkHash(hash);
        return res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[Network] /check-hash error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
/**
 * POST /api/v1/network/report-hash
 *
 * Report a hashed identity for an incident (e.g., COD_REJECTION).
 */
router.post('/report-hash', async (req, res) => {
    try {
        const { hash, type, description } = req.body;
        if (!hash || typeof hash !== 'string' || hash.length !== 64) {
            return res.status(400).json({
                success: false,
                error: 'Invalid hash. Must be a 64-character SHA256 string.',
            });
        }
        if (!type) {
            return res.status(400).json({
                success: false,
                error: 'type is required (e.g., COD_REJECTION, RETURN_FRAUD).',
            });
        }
        const apiClientId = req.apiClient?.id;
        const result = await network_service_1.networkService.reportHash(hash, type, description, apiClientId);
        return res.status(201).json(result);
    }
    catch (error) {
        logger_1.logger.error('[Network] /report-hash error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
/**
 * POST /api/v1/network/discover
 *
 * Natural-Language Discovery API (GB/Z 185.5 Compliance)
 * Allows external agents to discover merchants/agents on the network using
 * semantic natural language queries rather than strict identifiers.
 */
router.post('/discover', discovery_controller_1.discoverAgents);
exports.default = router;
//# sourceMappingURL=network.routes.js.map