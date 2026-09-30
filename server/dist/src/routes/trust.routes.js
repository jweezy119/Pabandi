"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const rateLimit_middleware_1 = require("../middleware/rateLimit.middleware");
const onchain_attestation_service_1 = require("../services/onchain-attestation.service");
const router = (0, express_1.Router)();
const JWT_SECRET = process.env.JWT_SECRET || 'pabandi-fallback-secret-2026';
const VC_EXPIRY_HOURS = 24;
function publicScores(passport) {
    return {
        payment: passport.paymentScore ?? 500,
        showUp: passport.showUpScore ?? 500,
        delivery: passport.deliveryScore ?? 500,
        tenancy: passport.tenancyScore ?? 500,
        freight: passport.freightScore ?? 500,
    };
}
/**
 * GET /api/v1/trust/resolve/:identifier
 * identifier can be: email, wallet address, github username, phone
 * Returns the linked TrustPassport with public scores only
 */
router.get('/resolve/:identifier', rateLimit_middleware_1.apiLimiter, async (req, res) => {
    try {
        const identifier = req.params.identifier;
        if (!identifier) {
            return res.status(400).json({ success: false, error: 'identifier is required' });
        }
        let passport = null;
        if (identifier.includes('@')) {
            passport = await database_1.prisma.trustPassport.findFirst({
                where: { userId: (await database_1.prisma.user.findUnique({ where: { email: identifier } }))?.id },
            });
        }
        else if (identifier.startsWith('0x') || identifier.length >= 32) {
            passport = await database_1.prisma.trustPassport.findFirst({
                where: { OR: [{ walletAddress: identifier }, { userId: (await database_1.prisma.user.findFirst({ where: { walletAddress: identifier } }))?.id }] },
            });
        }
        else {
            passport = await database_1.prisma.trustPassport.findFirst({
                where: { OR: [{ handle: { equals: identifier } }, { providerRef: identifier }] },
            });
        }
        if (!passport || passport.visibility !== 'PUBLIC') {
            return res.status(404).json({ success: false, error: 'Passport not found or private' });
        }
        return res.json({
            success: true,
            data: {
                handle: passport.handle,
                displayName: passport.displayName,
                category: passport.category,
                walletAddress: passport.walletAddress,
                claimsCount: passport.claimsCount,
                scores: publicScores(passport),
                verifiedIdentity: passport.verifiedIdentity,
                fraudFlag: passport.fraudFlag,
                issuedAt: new Date().toISOString(),
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[Trust] resolve error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/v1/trust/credential/:passportId
 * Returns a signed JWT verifiable credential for the passport
 */
router.get('/credential/:passportId', rateLimit_middleware_1.writeLimiter, async (req, res) => {
    try {
        const passportId = req.params.passportId;
        if (!passportId) {
            return res.status(400).json({ success: false, error: 'passportId is required' });
        }
        const passport = await database_1.prisma.trustPassport.findUnique({ where: { id: passportId } });
        if (!passport || passport.visibility !== 'PUBLIC') {
            return res.status(404).json({ success: false, error: 'Passport not found or private' });
        }
        const now = new Date();
        const expiresAt = new Date(now.getTime() + VC_EXPIRY_HOURS * 60 * 60 * 1000);
        const payload = {
            iss: 'https://pabandi.com',
            sub: passport.id,
            handle: passport.handle,
            displayName: passport.displayName,
            scores: publicScores(passport),
            verifiedEvents: passport.claimsCount,
            verifiedIdentity: passport.verifiedIdentity,
            issuedAt: now.toISOString(),
            expiresAt: expiresAt.toISOString(),
        };
        const signedJwt = jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: `${VC_EXPIRY_HOURS}h` });
        return res.json({
            success: true,
            data: {
                credential: signedJwt,
                publicKeyUrl: `${req.protocol}://${req.get('host')}/.well-known/pabandi-keys.json`,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[Trust] credential error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/v1/trust/public/:userId
 * Public trust profile for a user.
 */
router.get('/public/:userId', rateLimit_middleware_1.writeLimiter, async (req, res) => {
    try {
        const userId = req.params.userId;
        if (!userId) {
            return res.status(400).json({ success: false, error: 'userId is required' });
        }
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, firstName: true, lastName: true, email: true, trustScore: true, reliabilityScore: true },
        });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const passport = await database_1.prisma.trustPassport.findFirst({ where: { userId } });
        return res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    name: `${user.firstName} ${user.lastName}`.trim(),
                    email: user.email,
                    trustScore: user.trustScore,
                    reliabilityScore: user.reliabilityScore,
                },
                passport: passport
                    ? {
                        id: passport.id,
                        handle: passport.handle,
                        displayName: passport.displayName,
                        category: passport.category,
                        scores: publicScores(passport),
                        claimsCount: passport.claimsCount,
                        verifiedIdentity: passport.verifiedIdentity,
                    }
                    : null,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[Trust] public error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/v1/trust/:passportId/attestations
 * List onchain attestations for a passport.
 */
router.get('/:passportId/attestations', rateLimit_middleware_1.apiLimiter, async (req, res) => {
    try {
        const passportId = req.params.passportId;
        if (!passportId) {
            return res.status(400).json({ success: false, error: 'passportId is required' });
        }
        const passport = await database_1.prisma.trustPassport.findUnique({ where: { id: passportId } });
        if (!passport || passport.visibility !== 'PUBLIC') {
            return res.status(404).json({ success: false, error: 'Passport not found or private' });
        }
        const attestations = await (0, onchain_attestation_service_1.getAttestationsForPassport)(passportId);
        return res.json({
            success: true,
            data: {
                passportId,
                count: attestations.length,
                attestations: attestations.map(a => ({
                    eventType: a.eventType,
                    referenceId: a.referenceId,
                    txSignature: a.txSignature,
                    explorerUrl: a.explorerUrl,
                    createdAt: a.createdAt,
                })),
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[Trust] attestations error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * GET /api/v1/trust/:passportId/attestations/export
 * Export attestations as JSON download.
 */
router.get('/:passportId/attestations/export', rateLimit_middleware_1.apiLimiter, async (req, res) => {
    try {
        const passportId = req.params.passportId;
        if (!passportId) {
            return res.status(400).json({ success: false, error: 'passportId is required' });
        }
        const passport = await database_1.prisma.trustPassport.findUnique({ where: { id: passportId } });
        if (!passport || passport.visibility !== 'PUBLIC') {
            return res.status(404).json({ success: false, error: 'Passport not found or private' });
        }
        const attestations = await (0, onchain_attestation_service_1.getAttestationsForPassport)(passportId);
        const exportData = {
            passportId,
            handle: passport.handle,
            displayName: passport.displayName,
            exportedAt: new Date().toISOString(),
            attestations: attestations.map(a => ({
                eventType: a.eventType,
                referenceId: a.referenceId,
                txSignature: a.txSignature,
                explorerUrl: a.explorerUrl,
                createdAt: a.createdAt,
            })),
        };
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=attestations-${passport.handle || passportId}.json`);
        res.send(JSON.stringify(exportData, null, 2));
    }
    catch (error) {
        logger_1.logger.error(`[Trust] export error: ${error.message}`);
        return res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=trust.routes.js.map