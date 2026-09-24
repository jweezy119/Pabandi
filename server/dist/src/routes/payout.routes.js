"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payout_service_1 = require("../services/payout.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const database_1 = require("../utils/database");
const router = (0, express_1.Router)();
/**
 * @route GET /api/v1/payouts/quote?amount=500
 * @desc Quote a cash-out (fee + net + savings vs remittance)
 */
router.get('/quote', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const amount = Number(req.query.amount) || 0;
        const q = await payout_service_1.payoutService.quote(req.user.id, amount);
        res.json(q);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
/**
 * @route POST /api/v1/payouts/request
 * @desc Cash out earned USDC to bank / Connect account
 */
router.post('/request', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { amountUsdc, method, destinationRef } = req.body;
        const p = await payout_service_1.payoutService.request(req.user.id, Number(amountUsdc), (method || 'BANK'), destinationRef);
        res.status(201).json({ message: 'Cash-out settled', payout: p });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
/**
 * @route GET /api/v1/payouts/history
 * @desc Payout history
 */
router.get('/history', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const h = await payout_service_1.payoutService.history(req.user.id);
        res.json(h);
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
});
/**
 * @route POST /api/v1/payouts/migrate
 * @desc Create Payout table (Cloud Run FS read-only)
 */
router.post('/migrate', async (_req, res) => {
    try {
        await database_1.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "Payout" (
      "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "amountUsdc" DOUBLE PRECISION NOT NULL,
      "feeUsdc" DOUBLE PRECISION NOT NULL, "netUsdc" DOUBLE PRECISION NOT NULL,
      "method" TEXT NOT NULL DEFAULT 'BANK', "destinationRef" TEXT, "status" TEXT NOT NULL DEFAULT 'SETTLED',
      "txHash" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
    );`);
        await database_1.prisma.$executeRawUnsafe(`ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "offrampIntentId" TEXT`);
        await database_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payout_userId_idx" ON "Payout"("userId")`);
        await database_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payout_status_idx" ON "Payout"("status")`);
        res.json({ success: true, message: 'Payout table migrated' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=payout.routes.js.map