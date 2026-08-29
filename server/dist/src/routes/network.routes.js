"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const apiKey_middleware_1 = require("../middleware/apiKey.middleware");
const network_service_1 = require("../services/network.service");
const crypto_service_1 = require("../services/crypto.service");
const bloomFilter_service_1 = require("../services/bloomFilter.service");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const logger_1 = require("../utils/logger");
const discovery_controller_1 = require("../controllers/discovery.controller");
const router = (0, express_1.Router)();
/**
 * ── PUBLIC KEY EXCHANGE & FILTER ──────────────────────────────────────────
 * Allows the browser SDK to fetch the daily HMAC salt and the Bloom Filter.
 */
router.get('/public-salt', (req, res) => {
    res.json({ salt: crypto_service_1.cryptoService.getPublicSalt() });
});
router.get('/bloom-filter', (req, res) => {
    res.json({ filter: bloomFilter_service_1.bloomFilterService.getSerializedFilter() });
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