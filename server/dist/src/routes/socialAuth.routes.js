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
const passport_1 = __importDefault(require("passport"));
const passport_github2_1 = require("passport-github2");
const passport_twitter_1 = require("passport-twitter");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const router = (0, express_1.Router)();
// ═══════════════════════════════════════════════════════════════════════════════
// GITHUB OAUTH — No business verification required
// ═══════════════════════════════════════════════════════════════════════════════
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    passport_1.default.use(new passport_github2_1.Strategy({
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: `${process.env.API_URL || 'https://pabandi.onrender.com'}/api/v1/auth/social/github/callback`,
        scope: ['user:email'],
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email)
                return done(null, false, { message: 'No email from GitHub' });
            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        firstName: profile.displayName?.split(' ')[0] || profile.username,
                        lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
                        githubId: profile.id,
                        isEmailVerified: true,
                        password: '', // OAuth users don't need password
                    },
                });
            }
            return done(null, user);
        }
        catch (e) {
            return done(e, false);
        }
    }));
}
// GitHub OAuth routes
router.get('/github', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
    }
    passport_1.default.authenticate('github', { scope: ['user:email'] })(req, res, next);
});
router.get('/github/callback', (req, res, next) => {
    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
        return res.status(503).json({ success: false, message: 'GitHub OAuth not configured' });
    }
    passport_1.default.authenticate('github', { failureRedirect: '/login?error=github' })(req, res, next);
}, (req, res) => {
    const user = req.user;
    const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'fallback', { expiresIn: '7d' });
    res.redirect(`${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://pabandi.com'}/auth/callback?token=${token}`);
});
// ═══════════════════════════════════════════════════════════════════════════════
// TWITTER/X OAUTH — No business verification required
// ═══════════════════════════════════════════════════════════════════════════════
if (process.env.TWITTER_API_KEY && process.env.TWITTER_API_SECRET) {
    passport_1.default.use(new passport_twitter_1.Strategy({
        consumerKey: process.env.TWITTER_API_KEY,
        consumerSecret: process.env.TWITTER_API_SECRET,
        callbackURL: `${process.env.API_URL}/api/v1/auth/social/twitter/callback`,
        includeEmail: true,
    }, async (token, tokenSecret, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email)
                return done(null, false, { message: 'No email from Twitter' });
            let user = await prisma.user.findUnique({ where: { email } });
            if (!user) {
                user = await prisma.user.create({
                    data: {
                        email,
                        firstName: profile.displayName?.split(' ')[0] || profile.username,
                        lastName: profile.displayName?.split(' ').slice(1).join(' ') || '',
                        twitterId: profile.id,
                        isEmailVerified: true,
                        password: '',
                    },
                });
            }
            return done(null, user);
        }
        catch (e) {
            return done(e, false);
        }
    }));
}
router.get('/twitter', passport_1.default.authenticate('twitter'));
router.get('/twitter/callback', passport_1.default.authenticate('twitter', { failureRedirect: '/login?error=twitter' }), (req, res) => {
    const user = req.user;
    const token = jsonwebtoken_1.default.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET || 'fallback', { expiresIn: '7d' });
    res.redirect(`${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://pabandi.com'}/auth/callback?token=${token}`);
});
// ═══════════════════════════════════════════════════════════════════════════════
// OPENWA WHATSAPP — Self-hosted, free WhatsApp automation
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/whatsapp/send-confirmation', async (req, res, next) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message required' });
        }
        const { openwaService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp.service')));
        await openwaService.sendTextToBusiness(phone, message);
        res.json({ success: true, message: 'WhatsApp confirmation sent' });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to send WhatsApp' });
    }
});
router.get('/whatsapp/health', async (req, res, next) => {
    try {
        const { openwaService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp.service')));
        const health = await openwaService.healthCheck();
        res.json({ success: true, data: health });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'OpenWA health check failed' });
    }
});
// ═══════════════════════════════════════════════════════════════════════════════
// SMS — Twilio if configured, else OpenWA WhatsApp fallback
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/sms/send', async (req, res, next) => {
    try {
        const { phone, message } = req.body;
        if (!phone || !message) {
            return res.status(400).json({ error: 'Phone and message required' });
        }
        // Use Twilio if configured
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            const twilio = (await Promise.resolve().then(() => __importStar(require('twilio')))).default;
            const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: phone,
            });
            res.json({ success: true, message: 'SMS sent via Twilio' });
        }
        else {
            // Fallback: use OpenWA for WhatsApp instead
            const { openwaService } = await Promise.resolve().then(() => __importStar(require('../services/whatsapp.service')));
            await openwaService.sendTextToBusiness(phone, message);
            res.json({ success: true, message: 'Sent via WhatsApp (Twilio not configured)' });
        }
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to send SMS' });
    }
});
exports.default = router;
//# sourceMappingURL=socialAuth.routes.js.map