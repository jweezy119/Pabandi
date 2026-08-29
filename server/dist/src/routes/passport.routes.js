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
const passport_service_1 = require("../services/passport.service");
const logger_1 = require("../utils/logger");
const ecommerceReliabilityPredictor_1 = require("../services/ai/ecommerceReliabilityPredictor");
const router = (0, express_1.Router)();
// All passport routes require API key authentication and log usage
router.use(apiKey_middleware_1.apiKeyAuth);
router.use(apiKey_middleware_1.logApiUsage);
// ── Valid tiers for input validation ──────────────────────────────
const VALID_TIERS = ['Platinum', 'Gold', 'Silver', 'Bronze', 'Unrated'];
const VALID_INCIDENT_TYPES = ['NO_SHOW', 'FRAUD', 'NON_PAYMENT', 'HARASSMENT', 'QUALITY_ISSUE', 'OTHER'];
/**
 * POST /api/v1/passport/verify
 *
 * Full Passport lookup with optional tier threshold check.
 *
 * Body: { wallet_address: string, required_tier?: ScoreTier }
 * Returns: Full Passport object + tier check result
 */
router.post('/verify', async (req, res) => {
    try {
        const { wallet_address, required_tier } = req.body;
        if (!wallet_address || typeof wallet_address !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'wallet_address is required and must be a string.',
            });
        }
        if (required_tier && !VALID_TIERS.includes(required_tier)) {
            return res.status(400).json({
                success: false,
                error: `Invalid required_tier. Must be one of: ${VALID_TIERS.join(', ')}`,
            });
        }
        const result = await (0, passport_service_1.verifyPassport)(wallet_address, required_tier);
        if (result.status === 'not_found') {
            return res.status(404).json({
                success: false,
                status: 'not_found',
                message: result.message,
            });
        }
        if (result.status === 'below_threshold') {
            return res.status(402).json({
                success: true,
                status: 'below_threshold',
                message: result.message,
                required_tier: result.required_tier,
                actual_tier: result.actual_tier,
                action_required: result.action_required,
                passport: result.passport,
            });
        }
        return res.status(200).json({
            success: true,
            status: 'ok',
            passport: result.passport,
        });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /verify error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
/**
 * POST /api/v1/passport/eligibility
 *
 * Lightweight yes/no tier check. Does NOT return the full Passport object.
 *
 * Body: { wallet_address: string, required_tier: ScoreTier }
 * Returns: { status: "eligible" | "not_eligible", score_tier, action_required? }
 */
router.post('/eligibility', async (req, res) => {
    try {
        const { wallet_address, required_tier } = req.body;
        if (!wallet_address || typeof wallet_address !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'wallet_address is required and must be a string.',
            });
        }
        if (!required_tier || !VALID_TIERS.includes(required_tier)) {
            return res.status(400).json({
                success: false,
                error: `required_tier is required and must be one of: ${VALID_TIERS.join(', ')}`,
            });
        }
        const result = await (0, passport_service_1.checkEligibility)(wallet_address, required_tier);
        const statusCode = result.status === 'eligible' ? 200 : 402;
        return res.status(statusCode).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /eligibility error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
/**
 * POST /api/v1/passport/incidents
 *
 * Report a no-show, fraud, or other incident against a user.
 * This creates a Dispute record and adjusts the user's reliability score.
 *
 * Body: { wallet_address: string, type: DisputeType, description?: string }
 * Returns: { incident_id, status: "received", score_impact }
 */
router.post('/incidents', async (req, res) => {
    try {
        const { wallet_address, type, description } = req.body;
        if (!wallet_address || typeof wallet_address !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'wallet_address is required and must be a string.',
            });
        }
        if (!type || !VALID_INCIDENT_TYPES.includes(type)) {
            return res.status(400).json({
                success: false,
                error: `type is required and must be one of: ${VALID_INCIDENT_TYPES.join(', ')}`,
            });
        }
        const apiClientId = req.apiClient?.id;
        const result = await (0, passport_service_1.recordIncident)(wallet_address, type, description, apiClientId);
        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'No user found for this wallet address.',
            });
        }
        return res.status(201).json({
            success: true,
            ...result,
        });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /incidents error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
/**
 * POST /api/v1/passport/bind-x509
 *
 * Binds an X.509 PKI certificate to a Pabandi wallet identity.
 * This ensures compliance with Chinese GB/Z 185.3 standards for verifiable
 * machine identity and root CA trust chains.
 *
 * Body: { wallet_address: string, certificate: string, signed_nonce: string }
 */
router.post('/bind-x509', async (req, res) => {
    try {
        const { wallet_address, certificate, signed_nonce } = req.body;
        if (!wallet_address || !certificate || !signed_nonce) {
            return res.status(400).json({
                success: false,
                error: 'wallet_address, certificate, and signed_nonce are required.',
            });
        }
        const result = await (0, passport_service_1.bindX509Certificate)(wallet_address, certificate, signed_nonce);
        if (!result.success) {
            return res.status(400).json(result);
        }
        return res.status(200).json(result);
    }
    catch (error) {
        logger_1.logger.error('[Passport] /bind-x509 error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
/**
 * POST /api/v1/passport/predict-ecommerce
 *
 * Predicts the reliability of a buyer or seller on an e-commerce platform.
 * Emphasizes that Pabandi is an intelligence layer and does not process payments.
 *
 * Body: EcommerceFeatures object
 * Returns: EcommercePredictionResult object
 */
router.post('/predict-ecommerce', async (req, res) => {
    try {
        const features = req.body;
        if (!features || !features.role) {
            return res.status(400).json({
                success: false,
                error: 'Invalid features. "role" (BUYER or SELLER) is required.',
            });
        }
        const result = await ecommerceReliabilityPredictor_1.ecommerceReliabilityPredictor.predict(features);
        return res.status(200).json({
            success: true,
            prediction: result,
        });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /predict-ecommerce error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
/* ── Risk Engine ────────────────────────────────────────────────────────────── */
const apiGuard = (req, res, next) => {
    if (!req.apiClient)
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    return next();
};
router.use(apiGuard);
router.post('/score', async (req, res) => {
    try {
        const { userId, category } = req.body;
        const { computePassportScore } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await computePassportScore(userId, category || 'general');
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /score error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.get('/me', async (req, res) => {
    try {
        const userId = req.query.userId;
        const { getMyPassport } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await getMyPassport(userId);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /me error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.get('/public/:userId', async (req, res) => {
    try {
        const { getPublicPassport } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await getPublicPassport(req.params.userId);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /public error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.post('/vouch', async (req, res) => {
    try {
        const { sourceUserId, targetUserId } = req.body;
        const { vouchForUser } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await vouchForUser(sourceUserId, targetUserId);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /vouch error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.post('/signal/whatsapp-channel', async (req, res) => {
    try {
        const { userId } = req.body;
        const { recordWhatsAppChannelSignal } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await recordWhatsAppChannelSignal(userId, req.body);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /signal/whatsapp-channel error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.post('/signal/social-graph', async (req, res) => {
    try {
        const { userId } = req.body;
        const { recordSocialGraphSignal } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await recordSocialGraphSignal(userId, req.body);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /signal/social-graph error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.post('/web3/stake', async (req, res) => {
    try {
        const { userId } = req.body;
        const { recordWeb3Stake } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await recordWeb3Stake(userId, req.body);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /web3/stake error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.get('/export', async (req, res) => {
    try {
        const userId = req.query.userId;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required.' });
        }
        const { exportPassport } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await exportPassport(userId);
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /export error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
router.post('/dynamic-escrow', async (req, res) => {
    try {
        const { userId, category, transactionValue, currency } = req.body || {};
        if (!userId || !category || !transactionValue) {
            return res.status(400).json({ success: false, error: 'userId, category, and transactionValue are required.' });
        }
        const { calculateDynamicEscrow } = await Promise.resolve().then(() => __importStar(require('../services/passport-risk.service')));
        const result = await calculateDynamicEscrow({ userId, category, transactionValue, currency });
        return res.status(200).json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error('[Passport] /dynamic-escrow error:', error);
        return res.status(500).json({ success: false, error: 'Internal server error.' });
    }
});
exports.default = router;
//# sourceMappingURL=passport.routes.js.map