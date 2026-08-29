"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_middleware_1 = require("../middleware/auth.middleware");
const requirePassport_middleware_1 = require("../middleware/requirePassport.middleware");
const crypto_controller_1 = require("../controllers/crypto.controller");
const router = (0, express_1.Router)();
// ── Public ───────────────────────────────────────────────────────────────────
router.get('/reward-rules', crypto_controller_1.getRewardRules);
router.get('/contracts', crypto_controller_1.getContractAddresses); // deployed contract addresses for client
// ── Authenticated ─────────────────────────────────────────────────────────────
router.get('/wallet', auth_middleware_1.authenticate, crypto_controller_1.getMyWallet);
router.get('/rewards/business', auth_middleware_1.authenticate, crypto_controller_1.getBusinessRewards);
const withdrawalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 5, // limit each IP to 5 withdrawal requests per windowMs
    message: { success: false, error: 'Too many withdrawal attempts. Please try again after an hour to comply with security policies.' },
    standardHeaders: true,
    legacyHeaders: false,
});
router.put('/wallet/solana', auth_middleware_1.authenticate, crypto_controller_1.connectSolanaWallet);
router.post('/wallet/solana/transfer', auth_middleware_1.authenticate, withdrawalLimiter, (0, requirePassport_middleware_1.requirePassport)('act:transfer'), crypto_controller_1.requestSolanaTransfer);
// ── Staking ───────────────────────────────────────────────────────────────────
router.post('/wallet/stake', auth_middleware_1.authenticate, crypto_controller_1.stakeTokens);
router.post('/wallet/unstake', auth_middleware_1.authenticate, crypto_controller_1.unstakeTokens);
// ── NFT Badges ────────────────────────────────────────────────────────────────
// POST /api/v1/crypto/mint-badge — mint soulbound NFT for the user's connected wallet
router.post('/mint-badge', auth_middleware_1.authenticate, crypto_controller_1.mintBadge);
exports.default = router;
//# sourceMappingURL=crypto.routes.js.map