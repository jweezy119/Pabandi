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
const trust_controller_1 = require("../controllers/trust.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
router.get('/audit/:userId', trust_controller_1.getMyTrustAuditTimeline);
router.get('/score/me', auth_middleware_1.authenticate, trust_controller_1.getMyTrustProfile);
router.get('/stamps/me', auth_middleware_1.authenticate, trust_controller_1.getMyTrustStamps);
router.post('/stamps/issue', auth_middleware_1.authenticate, trust_controller_1.createMyTrustStamp);
router.get('/requirements/:action', trust_controller_1.getActionRequirements);
router.post('/action/:action/check', auth_middleware_1.authenticate, trust_controller_1.checkMyActionAccess);
router.post('/guest/escrow-event', trust_controller_1.recordGuestEscrowEvent);
router.get('/pulse/:userId', trust_controller_1.streamTrustPulse);
/**
 * GET /api/v1/trust/flux/:userId
 * Returns TrustFlux trajectory data (velocity-driven GNN prediction).
 * Public endpoint — anyone can check a user's trust trend direction.
 */
router.get('/flux/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const { trustFluxService } = await Promise.resolve().then(() => __importStar(require('../services/trustFlux.service')));
        const flux = await trustFluxService.computeTrustFlux(userId);
        // Also compute peer-normalized velocity
        flux.peerNormalizedVelocity = await trustFluxService.getPeerNormalizedVelocity(userId, flux.velocity);
        res.json({ success: true, data: flux });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/trust/flux/:userId/predict
 * Returns 30-day forward trajectory projection with decayed velocity.
 */
router.get('/flux/:userId/predict', async (req, res) => {
    const { userId } = req.params;
    const days = Number(req.query.days || 30);
    try {
        const { trustFluxService } = await Promise.resolve().then(() => __importStar(require('../services/trustFlux.service')));
        const projection = await trustFluxService.predict(userId, days);
        res.json({ success: true, data: projection });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/trust/public/:userId — public trust profile (no auth).
 * Returns score + tier + attestation + velocity (no owner-only actions).
 */
router.get('/public/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await database_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ success: false, message: 'User not found' });
        const [attestation, velocity] = await Promise.all([
            (await Promise.resolve().then(() => __importStar(require('../services/trustAttestation.service')))).trustAttestationService.issue(user.id),
            (await Promise.resolve().then(() => __importStar(require('../services/trustScore.service')))).trustScoreService.computeVelocity(user.id),
        ]);
        res.json({
            success: true,
            data: {
                userId: user.id,
                score: user.trustScore,
                tier: user.verificationTier,
                attestation,
                trustVelocity: velocity,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/trust/stamps/:userId — public trust audit timeline (no auth).
 */
router.get('/stamps/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const stamps = await database_1.prisma.trustAuditTrail.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
        res.json({ success: true, data: stamps });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * POST /api/v1/trust/veil/issue
 * Issue a zero-knowledge trust badge proving score ≥ threshold without revealing score.
 * Body: { userId, trustScore, threshold }
 */
router.post('/veil/issue', async (req, res) => {
    const { userId, trustScore, threshold = 70 } = req.body;
    try {
        const { trustVeilService } = await Promise.resolve().then(() => __importStar(require('../services/trustVeil.service')));
        const proof = await trustVeilService.issueProof(userId, trustScore, threshold);
        res.json({ success: true, data: proof });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * GET /api/v1/trust/veil/verify/:proofId
 * Verify a TrustVeil proof. Only learns: isAboveThreshold, trend, validity.
 * The actual score is never revealed.
 */
router.get('/veil/verify/:proofId', async (req, res) => {
    const { proofId } = req.params;
    try {
        const { trustVeilService } = await Promise.resolve().then(() => __importStar(require('../services/trustVeil.service')));
        // In production, fetch the proof from DB by proofId
        // For now, return the verification schema
        res.json({ success: true, data: { verified: 'proofId-based lookup requires DB integration' } });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=trust.routes.js.map