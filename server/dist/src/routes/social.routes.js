"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const passport_1 = __importDefault(require("passport"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const badge_service_1 = require("../services/badge.service");
const router = (0, express_1.Router)();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// ─── Real OAuth 2.0 Connection Endpoints ─────────────────────────────────────
// These routes must be BEFORE `router.use(authenticate)` because the OAuth 
// callback from Facebook/LinkedIn will not have the JWT Bearer header.
// FACEBOOK CONNECT
router.get('/connect/oauth/facebook', auth_middleware_1.authenticate, (req, res, next) => {
    if (!process.env.FACEBOOK_APP_ID) {
        return res.redirect(`${FRONTEND_URL}/profile?error=facebook_not_configured`);
    }
    // Securely pass the user's internal ID via a signed token in the state parameter
    const stateToken = jsonwebtoken_1.default.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
    passport_1.default.authenticate('facebook-connect', { scope: ['email', 'public_profile'], state: stateToken })(req, res, next);
});
router.get('/connect/facebook/callback', passport_1.default.authenticate('facebook-connect', { session: false, failureRedirect: `${FRONTEND_URL}/profile?error=facebook_failed` }), async (req, res) => {
    try {
        const profile = req.user;
        const stateToken = req.query.state;
        const decoded = jsonwebtoken_1.default.verify(stateToken, process.env.JWT_SECRET);
        const userId = decoded.userId;
        const stub = {
            isVerified: true,
            accountAgeDays: 365 * 3, // Real OAuth would pull this from graph API if available
            platformHandle: profile.emails?.[0]?.value || profile.id,
            trustBoost: 0,
        };
        const { totalBoost } = badge_service_1.badgeService.computeSocialTrustBoost([{ platform: 'FACEBOOK', ...stub }]);
        await database_1.prisma.socialIdentity.upsert({
            where: { userId_platform: { userId, platform: 'FACEBOOK' } },
            update: { ...stub, trustBoost: totalBoost, lastRefreshed: new Date() },
            create: { userId, platform: 'FACEBOOK', ...stub, trustBoost: totalBoost },
        });
        // Also simulate Meta integration by connecting Instagram and Whatsapp automatically
        for (const p of ['INSTAGRAM', 'WHATSAPP']) {
            const { totalBoost: pBoost } = badge_service_1.badgeService.computeSocialTrustBoost([{ platform: p, ...stub }]);
            await database_1.prisma.socialIdentity.upsert({
                where: { userId_platform: { userId, platform: p } },
                update: { ...stub, trustBoost: pBoost, lastRefreshed: new Date() },
                create: { userId, platform: p, ...stub, trustBoost: pBoost },
            });
        }
        return res.redirect(`${FRONTEND_URL}/profile?social_success=META`);
    }
    catch (e) {
        logger_1.logger.error('Facebook connect callback error', e);
        return res.redirect(`${FRONTEND_URL}/profile?error=facebook_failed`);
    }
});
// LINKEDIN CONNECT
router.get('/connect/oauth/linkedin', auth_middleware_1.authenticate, (req, res, next) => {
    if (!process.env.LINKEDIN_CLIENT_ID) {
        return res.redirect(`${FRONTEND_URL}/profile?error=linkedin_not_configured`);
    }
    const stateToken = jsonwebtoken_1.default.sign({ userId: req.user.id }, process.env.JWT_SECRET, { expiresIn: '10m' });
    passport_1.default.authenticate('linkedin-connect', { state: stateToken })(req, res, next);
});
router.get('/connect/linkedin/callback', passport_1.default.authenticate('linkedin-connect', { session: false, failureRedirect: `${FRONTEND_URL}/profile?error=linkedin_failed` }), async (req, res) => {
    try {
        const profile = req.user;
        const stateToken = req.query.state;
        const decoded = jsonwebtoken_1.default.verify(stateToken, process.env.JWT_SECRET);
        const userId = decoded.userId;
        const stub = {
            isVerified: true,
            completeness: 1.0,
            accountAgeDays: 365 * 2,
            platformHandle: profile.emails?.[0]?.value || profile.id,
            trustBoost: 0,
        };
        const { totalBoost } = badge_service_1.badgeService.computeSocialTrustBoost([{ platform: 'LINKEDIN', ...stub }]);
        await database_1.prisma.socialIdentity.upsert({
            where: { userId_platform: { userId, platform: 'LINKEDIN' } },
            update: { ...stub, trustBoost: totalBoost, lastRefreshed: new Date() },
            create: { userId, platform: 'LINKEDIN', ...stub, trustBoost: totalBoost },
        });
        return res.redirect(`${FRONTEND_URL}/profile?social_success=LINKEDIN`);
    }
    catch (e) {
        logger_1.logger.error('LinkedIn connect callback error', e);
        return res.redirect(`${FRONTEND_URL}/profile?error=linkedin_failed`);
    }
});
router.use(auth_middleware_1.authenticate);
// ─── Simulated OAuth metadata by platform ─────────────────────────────────────
// In production each platform gets its own OAuth flow. These are realistic
// stub profiles that simulate what the OAuth callback would return.
const STUB_PROFILES = {
    LINKEDIN: {
        isVerified: true,
        completeness: 0.92,
        accountAgeDays: 365 * 6,
        platformHandle: 'linkedin-professional',
        trustBoost: 0,
    },
    X_TWITTER: {
        isVerified: true,
        accountAgeDays: 365 * 5,
        platformHandle: '@user_handle',
        trustBoost: 0,
    },
    WHATSAPP: {
        isVerified: true,
        accountAgeDays: 365 * 4,
        platformHandle: '+1-xxx-xxx-xxxx',
        trustBoost: 0,
    },
    TIKTOK: {
        isVerified: false,
        accountAgeDays: 365 * 2,
        platformHandle: '@user_tiktok',
        trustBoost: 0,
    },
    INSTAGRAM: {
        isVerified: true,
        accountAgeDays: 365 * 5,
        platformHandle: '@user_insta',
        completeness: 0.85,
        trustBoost: 0,
    },
    FACEBOOK: {
        isVerified: true,
        accountAgeDays: 365 * 8,
        platformHandle: 'facebook-user',
        completeness: 0.90,
        trustBoost: 0,
    },
    FIVERR: {
        isVerified: true,
        accountAgeDays: 365 * 4,
        platformHandle: 'fiverr_pro',
        rating: 4.9,
        completionRate: 0.98,
        accountLevel: 'Top Rated Seller',
        trustBoost: 0,
    },
    UPWORK: {
        isVerified: true,
        accountAgeDays: 365 * 3,
        platformHandle: 'upwork_talent',
        rating: 5.0,
        completionRate: 1.0,
        accountLevel: 'Top Rated Plus',
        trustBoost: 0,
    },
};
const VALID_PLATFORMS = ['LINKEDIN', 'X_TWITTER', 'WHATSAPP', 'TIKTOK', 'INSTAGRAM', 'FACEBOOK', 'FIVERR', 'UPWORK'];
// The three Meta-owned platforms that connect together
const META_PLATFORMS = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK'];
/**
 * GET /api/v1/social/identities
 * Returns the authenticated user's connected social accounts.
 */
router.get('/identities', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const identities = await database_1.prisma.socialIdentity.findMany({ where: { userId } });
        const { totalBoost, breakdown } = badge_service_1.badgeService.computeSocialTrustBoost(identities);
        return res.json({
            success: true,
            data: {
                identities,
                socialTrustBoost: totalBoost,
                breakdown,
            },
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/v1/social/connect/META
 * Deprecated for real OAuth via /connect/oauth/facebook
 */
router.post('/connect/META', async (req, res, next) => {
    return res.status(400).json({ success: false, error: 'Please use the real Meta OAuth flow.' });
});
/**
 * POST /api/v1/social/connect/:platform
 * Manual social-identity connect route.
 * In production: full OAuth redirect flow is preferred for providers that support it.
 */
router.post('/connect/:platform', async (req, res, next) => {
    try {
        const platform = req.params.platform.toUpperCase();
        const userId = req.user.id;
        if (!VALID_PLATFORMS.includes(platform)) {
            return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
        }
        if (platform === 'LINKEDIN' || platform === 'FACEBOOK') {
            return res.status(400).json({ success: false, error: `Please use the real OAuth flow for ${platform}.` });
        }
        const stub = { ...STUB_PROFILES[platform] };
        if (req.body.platformHandle) {
            stub.platformHandle = req.body.platformHandle;
        }
        // Compute trust boost for this single identity
        const { totalBoost } = badge_service_1.badgeService.computeSocialTrustBoost([{ platform, ...stub }]);
        const identity = await database_1.prisma.socialIdentity.upsert({
            where: { userId_platform: { userId, platform: platform } },
            update: { ...stub, trustBoost: totalBoost, lastRefreshed: new Date() },
            create: { userId, platform: platform, ...stub, trustBoost: totalBoost },
        });
        logger_1.logger.info(`[Social] User ${userId} connected ${platform} (boost +${totalBoost})`);
        return res.status(201).json({
            success: true,
            data: { identity, trustBoost: totalBoost },
            message: `${platform} connected successfully. Your trust score received a +${totalBoost} boost.`,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/v1/social/disconnect/META
 * Disconnects all Meta platforms at once.
 */
router.delete('/disconnect/META', async (req, res, next) => {
    try {
        const userId = req.user.id;
        await database_1.prisma.socialIdentity.deleteMany({
            where: { userId, platform: { in: META_PLATFORMS } },
        });
        logger_1.logger.info(`[Social] User ${userId} disconnected all META platforms`);
        return res.json({
            success: true,
            message: `Meta platforms disconnected. WhatsApp, Instagram, and Facebook removed. Your score will recalculate.`,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * DELETE /api/v1/social/disconnect/:platform
 * Removes a social identity. Score recalculates on next fetch.
 */
router.delete('/disconnect/:platform', async (req, res, next) => {
    try {
        const platform = req.params.platform.toUpperCase();
        const userId = req.user.id;
        if (!VALID_PLATFORMS.includes(platform)) {
            return res.status(400).json({ success: false, error: `Unsupported platform: ${platform}` });
        }
        await database_1.prisma.socialIdentity.deleteMany({
            where: { userId, platform: platform },
        });
        logger_1.logger.info(`[Social] User ${userId} disconnected ${platform}`);
        return res.json({
            success: true,
            message: `${platform} disconnected. Your score will recalculate based on remaining signals.`,
        });
    }
    catch (error) {
        if (error?.code === 'P2025') {
            return res.status(404).json({ success: false, error: 'Account not connected' });
        }
        next(error);
    }
});
/**
 * GET /api/v1/social/share-card?platform=LINKEDIN
 * Returns pre-written share text and badge URL for a given platform.
 */
router.get('/share-card', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const platform = (req.query.platform || 'X_TWITTER').toUpperCase();
        const card = await badge_service_1.badgeService.getShareCard(userId, platform);
        return res.json({ success: true, data: card });
    }
    catch (error) {
        next(error);
    }
});
/**
 * GET /api/v1/social/my-badge
 * Returns the authenticated user's full badge payload including their pseudonymous ID.
 */
router.get('/my-badge', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const badge = await badge_service_1.badgeService.computeBadgeStatus(userId);
        return res.json({ success: true, data: badge });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=social.routes.js.map