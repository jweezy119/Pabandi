"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const jevSecurity_service_1 = require("../services/jevSecurity.service");
const router = (0, express_1.Router)();
// ── FRICTIONLESS PAYMENT ──────────────────────────────
router.post('/pay', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { amount, description, recipientId, route } = req.body;
        const userId = req.user.id;
        // Jev security check
        const security = await jevSecurity_service_1.jevSecurity.checkTransactionSecurity({
            from: userId,
            to: recipientId || 'platform',
            amount,
            token: 'USDC',
            timestamp: Date.now(),
            userHistory: {
                totalTransactions: 10,
                totalVolume: 5000,
                avgTransactionSize: 500,
                lastTransactionTime: Date.now() - 86400000,
                disputes: 0,
                trustScore: 500,
            },
        });
        if (!security.approved) {
            return res.status(400).json({
                success: false,
                message: 'Payment could not be processed. Please try again.',
            });
        }
        // Calculate savings from PAB
        const pabPercent = route?.pabPercent ?? 0;
        const savings = (amount * pabPercent / 100) * 0.05;
        // Record payment (using BookingPabRecord as a generic payment log)
        const payment = await database_1.prisma.bookingRecord.create({
            data: {
                bookingId: 'frictionless_' + Date.now(),
                userId,
                bookingValue: amount,
                depositPab: 0,
                rewardPab: savings / 0.000178, // Convert to PAB tokens
                status: 'CHECKED_IN',
                description,
                txHash: 'frictionless_' + Date.now(),
            },
        });
        res.json({
            success: true,
            data: {
                success: true,
                amountCharged: amount,
                savings,
                method: pabPercent > 50 ? 'pab' : 'usdc',
                txHash: payment.id,
            },
        });
    }
    catch (err) {
        console.error('[Frictionless] Payment error:', err.message);
        res.status(500).json({
            success: false,
            message: 'Payment failed. Retrying...',
        });
    }
});
// ── AUTO-RETRY ────────────────────────────────────────
router.post('/retry', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { amount, description } = req.body;
        const userId = req.user.id;
        const payment = await database_1.prisma.bookingRecord.create({
            data: {
                bookingId: 'retry_' + Date.now(),
                userId,
                bookingValue: amount,
                depositPab: 0,
                rewardPab: 0,
                status: 'CHECKED_IN',
                description: description + ' (retry)',
                txHash: 'retry_' + Date.now(),
            },
        });
        res.json({
            success: true,
            data: {
                success: true,
                amountCharged: amount,
                savings: 0,
                method: 'usdc',
                txHash: payment.id,
            },
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Retry failed. Please try again later.',
        });
    }
});
// ── GUEST CHECKOUT ────────────────────────────────────
router.post('/guest-pay', async (req, res) => {
    try {
        const { amount } = req.body;
        res.json({
            success: true,
            data: {
                success: true,
                amountCharged: amount,
                savings: 0,
                method: 'usdc',
                txHash: 'guest_' + Date.now(),
            },
        });
    }
    catch (err) {
        res.status(500).json({
            success: false,
            message: 'Payment failed.',
        });
    }
});
exports.default = router;
//# sourceMappingURL=frictionless.routes.js.map