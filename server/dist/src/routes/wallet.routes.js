"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_service_1 = require("../services/wallet.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Create wallet
router.post('/create', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await wallet_service_1.walletService.createWallet(userId);
        res.status(201).json(result);
    }
    catch (error) {
        next(error);
    }
});
// Get wallet
router.get('/', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await wallet_service_1.walletService.getWallet(userId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Claim airdrop
router.post('/claim-airdrop', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const result = await wallet_service_1.walletService.claimAirdrop(userId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=wallet.routes.js.map