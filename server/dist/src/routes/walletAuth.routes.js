"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const logger_1 = require("../utils/logger");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const web3_js_1 = require("@solana/web3.js");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = (0, express_1.Router)();
// ── POST /api/v1/auth/wallet/verify ──────────────────────────────────────────
// Verify a Solana wallet signature (Phantom, Solflare, etc.).
// Client signs a message server provides; server verifies the signature.
router.post('/verify', async (req, res) => {
    try {
        const { walletAddress, signature, message } = req.body;
        if (!walletAddress || !signature || !message) {
            return res.status(400).json({
                success: false,
                error: 'walletAddress, signature, and message are required',
            });
        }
        // Verify the signature is valid for this wallet + message.
        try {
            const pubKey = new web3_js_1.PublicKey(walletAddress);
            const msgBytes = new TextEncoder().encode(message);
            const sigBytes = Buffer.from(signature, 'base64');
            const valid = tweetnacl_1.default.sign.detached.verify(msgBytes, sigBytes, pubKey.toBytes());
            if (!valid) {
                return res.status(401).json({ success: false, error: 'Invalid signature' });
            }
        }
        catch (e) {
            return res.status(400).json({ success: false, error: 'Invalid wallet address or signature' });
        }
        // Find or create user by wallet address.
        let user = await database_1.prisma.user.findFirst({ where: { walletAddress } });
        if (!user) {
            // Create a wallet-only user.
            user = await database_1.prisma.user.create({
                data: {
                    email: `${walletAddress.slice(0, 8)}@wallet.pabandi.com`,
                    passwordHash: '', // wallet auth, no password
                    firstName: 'Wallet',
                    lastName: walletAddress.slice(-4),
                    walletAddress,
                    role: 'CUSTOMER',
                },
            });
        }
        // Generate a short-lived JWT session token (signed with JWT_SECRET so the auth
        // middleware can verify it with jwt.verify — the old base64(userId:timestamp)
        // format was not a real JWT and could not be verified).
        const token = jsonwebtoken_1.default.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'insecure-dev-secret', { expiresIn: '24h' });
        res.json({
            success: true,
            data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    walletAddress: user.walletAddress,
                    trustScore: user.trustScore,
                    role: user.role,
                },
            },
        });
    }
    catch (e) {
        logger_1.logger.error('Wallet verify failed:', e);
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── GET /api/v1/auth/wallet/nonce ────────────────────────────────────────────
// Get a nonce (challenge message) for the wallet to sign.
router.get('/nonce/:walletAddress', async (req, res) => {
    try {
        const { walletAddress } = req.params;
        const timestamp = Date.now();
        const message = `Sign this message to verify your identity with Pabandi.\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\nNonce: ${Math.random().toString(36).slice(2)}`;
        res.json({
            success: true,
            data: {
                message,
                timestamp,
            },
        });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=walletAuth.routes.js.map