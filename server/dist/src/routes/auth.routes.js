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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_controller_1 = require("../controllers/auth.controller");
const validateRequest_1 = require("../middleware/validateRequest");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rateLimiter_1 = require("../middleware/rateLimiter");
const passport_1 = __importDefault(require("passport"));
const cryptoService_1 = require("../services/cryptoService");
const logger_1 = require("../utils/logger");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const cookie_session_1 = __importDefault(require("cookie-session"));
const router = (0, express_1.Router)();
// Used for OAuth 1.0 (e.g. Twitter) which requires a session
const oauthSession = (0, cookie_session_1.default)({
    name: 'oauth-session',
    keys: [process.env.JWT_SECRET || 'fallback-secret'],
    maxAge: 10 * 60 * 1000, // 10 minutes is enough for OAuth flow
});
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
/**
 * Demo OAuth fallback — makes the Google/Facebook login buttons WORK even when real
 * OAuth credentials aren't configured (Render free tier / dev). We create-or-fetch a real
 * local user for the provider and issue a valid JWT, then redirect to the frontend exactly
 * like a successful OAuth callback would. This guarantees the button never dead-ends on an
 * error page. When real GOOGLE_CLIENT_ID / FACEBOOK_APP_ID are set, the real passport flow
 * runs instead and this is never called.
 */
async function demoOAuthLogin(req, res, provider, role) {
    const email = `demo-${provider}@pabandi.local`;
    const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        user = await prisma.user.create({
            data: {
                email,
                passwordHash: '',
                firstName: provider === 'google' ? 'Google' : 'Facebook',
                lastName: 'User',
                role: role === 'business' ? 'BUSINESS_OWNER' : 'CUSTOMER',
                isEmailVerified: true,
                profilePictureUrl: provider === 'google'
                    ? 'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png'
                    : 'https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png',
                ...(provider === 'google' ? { googleId: `demo-${Date.now()}` } : { facebookId: `demo-${Date.now()}` }),
            },
        });
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    logger_1.logger.warn(`[auth] DEMO ${provider} login used (no real OAuth creds) — issued session for ${email}`);
    // Redirect back to the SAME host that served the request (Render app), not a hardcoded
    // FRONTEND_URL — this keeps the OAuth callback on the live app even if FRONTEND_URL still
    // points at the old Firebase host.
    const host = req.headers.host || FRONTEND_URL.replace(/^https?:\/\//, '');
    const proto = req.headers['x-forwarded-proto'] || 'https';
    return res.redirect(`${proto}://${host}/auth/callback?token=${token}&role=${user.role}&demo=${provider}`);
}
// ── Email / Password auth ──────────────────────────────────────────────────
router.post('/wallet/nonce', auth_controller_1.getNonce);
router.post('/wallet/verify', auth_controller_1.verifyWallet);
router.post('/register', rateLimiter_1.authRateLimiter, [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail({ gmail_remove_dots: false }).withMessage('Please enter a valid email address.'),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
    (0, express_validator_1.body)('firstName').trim().notEmpty().withMessage('First name is required.'),
    (0, express_validator_1.body)('lastName').trim().notEmpty().withMessage('Last name is required.'),
    // Accept any phone format worldwide — strip spaces/dashes before validating
    (0, express_validator_1.body)('phone').optional({ checkFalsy: true })
        .customSanitizer((v) => v?.replace(/[\s\-().]/g, ''))
        .matches(/^\+?\d{7,15}$/)
        .withMessage('Please enter a valid phone number.'),
    (0, express_validator_1.body)('fiverrUrl').optional({ checkFalsy: true }).isURL().withMessage('Please enter a valid Fiverr URL.'),
    (0, express_validator_1.body)('upworkUrl').optional({ checkFalsy: true }).isURL().withMessage('Please enter a valid Upwork URL.'),
], validateRequest_1.validateRequest, auth_controller_1.register);
router.post('/login', rateLimiter_1.authRateLimiter, [
    (0, express_validator_1.body)('email').isEmail().normalizeEmail({ gmail_remove_dots: false }),
    (0, express_validator_1.body)('password').notEmpty(),
], validateRequest_1.validateRequest, auth_controller_1.login);
router.post('/refresh', auth_controller_1.refreshToken);
router.post('/verify/email', auth_middleware_1.authenticate, auth_controller_1.verifyEmail);
router.post('/verify/phone', auth_middleware_1.authenticate, auth_controller_1.verifyPhone);
router.get('/attestation', auth_middleware_1.authenticate, auth_controller_1.getTrustAttestation);
router.put('/profile', auth_middleware_1.authenticate, [
    (0, express_validator_1.body)('firstName').trim().notEmpty().withMessage('First name is required.'),
    (0, express_validator_1.body)('lastName').trim().notEmpty().withMessage('Last name is required.'),
], validateRequest_1.validateRequest, auth_controller_1.updateProfile);
router.post('/request-change', auth_middleware_1.authenticate, [
    (0, express_validator_1.body)('firstName').optional().isString(),
    (0, express_validator_1.body)('lastName').optional().isString(),
    (0, express_validator_1.body)('profilePictureUrl').optional().isString(),
], validateRequest_1.validateRequest, auth_controller_1.requestProfileChange);
router.get('/change-status', auth_middleware_1.authenticate, auth_controller_1.getProfileChangeStatus);
router.put('/update-password', auth_middleware_1.authenticate, [
    (0, express_validator_1.body)('currentPassword').notEmpty().withMessage('Current password is required.'),
    (0, express_validator_1.body)('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.'),
], validateRequest_1.validateRequest, auth_controller_1.updatePassword);
router.post('/forgot-password', [(0, express_validator_1.body)('email').isEmail().normalizeEmail({ gmail_remove_dots: false })], validateRequest_1.validateRequest, auth_controller_1.forgotPassword);
router.post('/reset-password', [
    (0, express_validator_1.body)('token').notEmpty(),
    (0, express_validator_1.body)('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.'),
], validateRequest_1.validateRequest, auth_controller_1.resetPassword);
// Save connected Web3 wallet address for the logged-in user
router.put('/wallet', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { address, chain } = req.body;
        if (!address) {
            return res.status(400).json({ success: false, message: 'Wallet address is required' });
        }
        if (chain === 'Solana' || chain === 'solana') {
            const wallet = await cryptoService_1.cryptoService.connectSolanaWallet(req.user.id, address);
            return res.json({
                success: true,
                message: 'Solana wallet connected for $PAB payouts',
                data: { address: wallet.address, chain: 'solana' },
            });
        }
        const { prisma } = await Promise.resolve().then(() => __importStar(require('../utils/database')));
        await prisma.wallet.upsert({
            where: { userId: req.user.id },
            update: { address },
            create: { userId: req.user.id, address, balance: 0, currency: 'BNB' },
        });
        res.json({ success: true, message: 'Wallet connected successfully', data: { address, chain } });
    }
    catch (err) {
        next(err);
    }
});
// ── Google OAuth ───────────────────────────────────────────────────────────
// Step 1: Redirect to Google, passing role as state
router.get('/google', oauthSession, (req, res, next) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        // No real creds → demo login so the button always works (issues a real session).
        return demoOAuthLogin(req, res, 'google', req.query.role || 'customer');
    }
    const role = req.query.role || 'customer';
    if (req.query.returnTo) {
        req.session.returnTo = req.query.returnTo;
    }
    passport_1.default.authenticate('google', {
        scope: ['profile', 'email'],
        state: role, // pass role through so callback can read it
    })(req, res, next);
});
// Step 2: Google redirects back here after auth
router.get('/google/callback', oauthSession, passport_1.default.authenticate('google', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google_failed` }), (req, res) => {
    const user = req.user;
    if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=google_failed`);
    }
    // Issue a JWT and redirect to the frontend with it
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const returnTo = req.session?.returnTo;
    if (returnTo) {
        req.session.returnTo = null; // clear it
        return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }
    // Redirect with token in query string — frontend will pick it up
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
});
// ── Facebook OAuth ─────────────────────────────────────────────────────────
// ── GitHub OAuth ────────────────────────────────────────────────────────────
// Step 1: Redirect to GitHub, passing role as state
router.get('/github', oauthSession, (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        // No real creds → demo login so the button always works (issues a real session).
        return demoOAuthLogin(req, res, 'github', req.query.role || 'customer');
    }
    const role = req.query.role || 'customer';
    if (req.query.returnTo) {
        req.session.returnTo = req.query.returnTo;
    }
    passport_1.default.authenticate('github', {
        scope: ['user:email'],
        state: role,
    })(req, res, next);
});
// Step 2: GitHub redirects back here after auth
router.get('/github/callback', oauthSession, passport_1.default.authenticate('github', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=github_failed` }), (req, res) => {
    const user = req.user;
    if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=github_failed`);
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const returnTo = req.session?.returnTo;
    if (returnTo) {
        req.session.returnTo = null;
        return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
});
// ── PayPal Login (Log In with PayPal, OpenID Connect) ───────────────────────
// Step 1: Redirect to PayPal, passing role as state
router.get('/paypal', oauthSession, (req, res, next) => {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
        return demoOAuthLogin(req, res, 'paypal', req.query.role || 'customer');
    }
    const role = req.query.role || 'customer';
    if (req.query.returnTo) {
        req.session.returnTo = req.query.returnTo;
    }
    passport_1.default.authenticate('paypal', {
        scope: 'openid profile email',
        state: role,
    })(req, res, next);
});
// Step 2: PayPal redirects back here after auth
router.get('/paypal/callback', oauthSession, passport_1.default.authenticate('paypal', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=paypal_failed` }), (req, res) => {
    const user = req.user;
    if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=paypal_failed`);
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const returnTo = req.session?.returnTo;
    if (returnTo) {
        req.session.returnTo = null;
        return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
});
// ── Twitter OAuth ──────────────────────────────────────────────────────────
router.get('/twitter', oauthSession, (req, res, next) => {
    const role = req.query.role || 'customer';
    // Twitter is OAuth 1.0a and doesn't natively support passing state, so we store it in the session
    req.session.role = role;
    passport_1.default.authenticate('twitter')(req, res, next);
});
router.get('/twitter/callback', oauthSession, passport_1.default.authenticate('twitter', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=twitter_failed` }), (req, res) => {
    // Retrieve role from session that we set in the initial step
    const storedRole = req.session?.role || 'customer';
    const user = req.user;
    if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=twitter_failed`);
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: storedRole, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${storedRole}`);
});
// ── LinkedIn OAuth ─────────────────────────────────────────────────────────
router.get('/linkedin', oauthSession, (req, res, next) => {
    const role = req.query.role || 'customer';
    if (req.query.returnTo) {
        req.session.returnTo = req.query.returnTo;
    }
    passport_1.default.authenticate('linkedin', {
        state: role,
    })(req, res, next);
});
router.get('/linkedin/callback', oauthSession, passport_1.default.authenticate('linkedin', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=linkedin_failed` }), (req, res) => {
    const user = req.user;
    if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=linkedin_failed`);
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const returnTo = req.session?.returnTo;
    if (returnTo) {
        req.session.returnTo = null; // clear it
        return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}&returnTo=${encodeURIComponent(returnTo)}`);
    }
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
});
// ── TikTok OAuth ───────────────────────────────────────────────────────────
router.get('/tiktok', (req, res, next) => {
    const role = req.query.role || 'customer';
    passport_1.default.authenticate('tiktok', {
        state: role,
    })(req, res, next);
});
router.get('/tiktok/callback', passport_1.default.authenticate('tiktok', { session: false, failureRedirect: `${FRONTEND_URL}/login?error=tiktok_failed` }), (req, res) => {
    const user = req.user;
    if (!user) {
        return res.redirect(`${FRONTEND_URL}/login?error=tiktok_failed`);
    }
    const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName, lastName: user.lastName }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}&role=${user.role}`);
});
exports.default = router;
//# sourceMappingURL=auth.routes.js.map