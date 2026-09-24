"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
// Lightweight GitHub OAuth — no Passport required
// Uses direct OAuth 2.0 flow with fetch()
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const API_URL = process.env.API_URL || 'https://pabandi.onrender.com';
const CLIENT_URL = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://pabandi.com';
const JWT_SECRET = process.env.JWT_SECRET || 'insecure-dev-secret';
const CALLBACK_URL = `${API_URL}/api/v1/auth/social/github/callback`;
// Step 1: Redirect user to GitHub for authorization
router.get('/github', (req, res) => {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        return res.status(503).json({
            success: false,
            message: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.'
        });
    }
    const role = req.query.role || 'customer';
    const state = Buffer.from(JSON.stringify({ role, timestamp: Date.now() })).toString('base64');
    const authUrl = `https://github.com/login/oauth/authorize?` + new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: CALLBACK_URL,
        scope: 'read:user user:email',
        state,
    }).toString();
    res.redirect(authUrl);
});
// Step 2: Handle GitHub callback
router.get('/github/callback', async (req, res) => {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
        return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
    }
    const { code, state, error, error_description } = req.query;
    if (error) {
        logger_1.logger.warn('GitHub OAuth error:', error, error_description);
        const msg = error_description || error || 'Authorization failed';
        return res.redirect(`${CLIENT_URL}/login?error=github&message=${encodeURIComponent(msg)}`);
    }
    if (!code) {
        return res.redirect(`${CLIENT_URL}/login?error=github&message=Missing authorization code`);
    }
    try {
        logger_1.logger.info('GitHub OAuth callback received', { hasCode: !!code, hasState: !!state });
        // Exchange code for access token
        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: CALLBACK_URL,
            }),
        });
        const tokenData = await tokenResponse.json();
        logger_1.logger.info('GitHub token exchange', {
            success: !!tokenData.access_token,
            error: tokenData.error,
            errorDescription: tokenData.error_description
        });
        const accessToken = tokenData.access_token;
        if (!accessToken) {
            logger_1.logger.error('GitHub token exchange failed:', tokenData);
            return res.redirect(`${CLIENT_URL}/login?error=github&message=${encodeURIComponent(tokenData.error_description || 'Failed to obtain access token')}`);
        }
        // Fetch user profile
        const userResponse = await fetch('https://api.github.com/user', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github+json',
            },
        });
        if (!userResponse.ok) {
            const err = await userResponse.json();
            logger_1.logger.error('GitHub user fetch failed:', { status: userResponse.status, error: err });
            return res.redirect(`${CLIENT_URL}/login?error=github&message=Failed to fetch GitHub profile`);
        }
        const profile = await userResponse.json();
        logger_1.logger.info('GitHub profile fetched', { login: profile.login, id: profile.id, hasPublicEmail: !!profile.email });
        // Granted scopes reveal scope-downgrade issues (e.g. stale grant without user:email)
        logger_1.logger.info('GitHub granted scopes', { scopes: userResponse.headers.get('x-oauth-scopes') });
        // Fetch user emails
        const emailResponse = await fetch('https://api.github.com/user/emails', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/vnd.github+json',
            },
        });
        if (!emailResponse.ok) {
            const err = await emailResponse.json();
            logger_1.logger.error('GitHub emails fetch failed:', { status: emailResponse.status, error: err });
            return res.redirect(`${CLIENT_URL}/login?error=github&message=Failed to fetch GitHub emails`);
        }
        const emails = await emailResponse.json();
        logger_1.logger.info('GitHub emails fetched', { count: Array.isArray(emails) ? emails.length : 'non-array' });
        const emailList = Array.isArray(emails) ? emails : [];
        // GitHub's email objects look like { email, primary, verified, visibility }.
        // Prefer verified addresses, but fall back gracefully: public profile
        // email, then primary (even unverified), then anything usable — an
        // account with an unverified email beats a failed login.
        const verifiedPrimary = emailList.find((e) => e.primary && e.verified)?.email;
        const verifiedAny = emailList.find((e) => e.verified)?.email;
        const primaryAny = emailList.find((e) => e.primary)?.email;
        const firstAny = emailList[0]?.email;
        const primaryEmail = verifiedPrimary || profile.email || verifiedAny || primaryAny || firstAny;
        const emailVerified = !!(verifiedPrimary || verifiedAny);
        if (!primaryEmail) {
            logger_1.logger.warn('No usable email from GitHub', { count: emailList.length });
            return res.redirect(`${CLIENT_URL}/login?error=github&message=${encodeURIComponent('GitHub returned no email address. Add and verify an email at github.com/settings/emails, then try again.')}`);
        }
        logger_1.logger.info('Primary email found', { email: primaryEmail });
        // Find or create user
        logger_1.logger.info('Looking up user in DB', { email: primaryEmail });
        let user = await database_1.prisma.user.findUnique({ where: { email: primaryEmail } });
        logger_1.logger.info('User lookup result', { found: !!user, userId: user?.id });
        if (!user) {
            logger_1.logger.info('Creating new user', { email: primaryEmail });
            const displayName = profile.name || profile.login;
            const nameParts = displayName.split(' ');
            user = await database_1.prisma.user.create({
                data: {
                    email: primaryEmail,
                    firstName: nameParts[0] || profile.login,
                    lastName: nameParts.slice(1).join(' ') || '',
                    githubId: profile.id.toString(),
                    isEmailVerified: emailVerified,
                    passwordHash: '', // OAuth users don't need password
                    role: 'CUSTOMER',
                    reliabilityScore: 750,
                    trustScore: 50.0,
                    verificationTier: 'BASIC',
                    gracePeriodUntil: new Date(Date.now() + 48 * 60 * 60 * 1000),
                },
            });
            logger_1.logger.info('User created', { userId: user.id });
        }
        // Generate JWT (include names so the callback can seed the session)
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role, firstName: user.firstName || '', lastName: user.lastName || '' }, JWT_SECRET, { expiresIn: '7d' });
        // Redirect to frontend with token
        const roleParam = state ? JSON.parse(Buffer.from(state, 'base64').toString()).role : 'customer';
        res.redirect(`${CLIENT_URL}/auth/callback?token=${token}&role=${roleParam}`);
    }
    catch (e) {
        logger_1.logger.error('GitHub OAuth callback error:', {
            message: e.message,
            stack: e.stack,
            code: e.code,
            meta: e.meta,
        });
        const msg = e.message?.substring(0, 200) || 'Unknown error';
        res.redirect(`${CLIENT_URL}/login?error=github&message=${encodeURIComponent(msg)}`);
    }
});
exports.default = router;
//# sourceMappingURL=githubAuth.routes.js.map