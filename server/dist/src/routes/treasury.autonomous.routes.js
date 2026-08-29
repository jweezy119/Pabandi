"use strict";
/**
 * Pabandi Autonomous Treasury API
 * ---------------------------------
 * Exposes the orchestrator to the frontend + external webhooks.
 * Runs in SIMULATOR mode by default — full flow works with zero banking partner.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const orchestrator_service_1 = require("../services/treasury/orchestrator.service");
const router = (0, express_1.Router)();
/**
 * Create a virtual bank account for the authenticated user.
 * POST /api/v1/treasury/virtual-account
 */
router.post('/virtual-account', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, error: 'Unauthenticated' });
        const va = await orchestrator_service_1.treasuryOrchestrator.issueVirtualAccount(userId);
        res.json({ success: true, data: va });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Get the authenticated user's virtual account deposit instructions.
 * GET /api/v1/treasury/virtual-account
 */
router.get('/virtual-account', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ success: false, error: 'Unauthenticated' });
        const va = await orchestrator_service_1.treasuryOrchestrator.issueVirtualAccount(userId); // idempotent
        res.json({ success: true, data: va });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Webhook: simulate / receive an incoming fiat wire to a virtual account.
 * POST /api/v1/treasury/webhooks/fiat-deposit
 * body: { virtualAccountId, amountUsd }
 */
router.post('/webhooks/fiat-deposit', async (req, res) => {
    try {
        const { virtualAccountId, amountUsd } = req.body ?? {};
        if (!virtualAccountId || !amountUsd) {
            return res.status(400).json({ success: false, error: 'virtualAccountId and amountUsd required' });
        }
        const pos = await orchestrator_service_1.treasuryOrchestrator.handleIncomingWire(virtualAccountId, Number(amountUsd));
        res.json({ success: true, data: pos });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Sweep a pending fiat position into on-chain stablecoin.
 * POST /api/v1/treasury/sweep
 * body: { treasuryPositionId, destinationWallet }
 */
router.post('/sweep', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { treasuryPositionId, destinationWallet } = req.body ?? {};
        if (!treasuryPositionId || !destinationWallet) {
            return res.status(400).json({ success: false, error: 'treasuryPositionId and destinationWallet required' });
        }
        const result = await orchestrator_service_1.treasuryOrchestrator.sweepToWeb3(treasuryPositionId, destinationWallet);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Run the full demo flow (issue account → wire → sweep) for the profitability report.
 * POST /api/v1/treasury/demo-flow
 * body: { amountUsd, destinationWallet }
 */
router.post('/demo-flow', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const { amountUsd, destinationWallet } = req.body ?? {};
        if (!amountUsd || !destinationWallet) {
            return res.status(400).json({ success: false, error: 'amountUsd and destinationWallet required' });
        }
        const result = await orchestrator_service_1.treasuryOrchestrator.runDemoFlow(userId, Number(amountUsd), destinationWallet);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Ledger view for the profitability report.
 * GET /api/v1/treasury/ledger
 */
router.get('/ledger', auth_middleware_1.authenticate, async (_req, res) => {
    try {
        const ledger = await orchestrator_service_1.treasuryOrchestrator.getLedger(50);
        res.json({ success: true, data: ledger });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
/**
 * Combined profitability summary across ALL revenue sources.
 * GET /api/v1/treasury/autonomous-summary
 * (authenticated users — aggregate read-only reporting)
 */
router.get('/autonomous-summary', auth_middleware_1.authenticate, async (_req, res) => {
    try {
        const ledger = await orchestrator_service_1.treasuryOrchestrator.getLedger(1000);
        const summary = {};
        for (const row of ledger) {
            const b = row.bucket;
            const asset = row.meta?.asset ?? 'USD';
            summary[b] = summary[b] ?? { count: 0, pab: 0, usdc: 0 };
            summary[b].count++;
            if (asset === 'PAB')
                summary[b].pab += row.amount;
            else
                summary[b].usdc += row.amount;
        }
        const totalPabRevenue = (summary['AGENT_REVENUE']?.pab ?? 0) + (summary['SWEEP_OUT']?.usdc ?? 0);
        const totalUsdcRevenue = (summary['AGENT_REVENUE']?.usdc ?? 0) + (summary['SWEEP_OUT']?.usdc ?? 0);
        const totalBurnedPab = summary['BURN']?.pab ?? 0;
        const totalFiatSwept = summary['SWEEP_OUT']?.usdc ?? 0;
        res.json({
            success: true,
            data: {
                buckets: summary,
                totals: {
                    pabRevenue: +totalPabRevenue.toFixed(4),
                    usdcRevenue: +totalUsdcRevenue.toFixed(2),
                    burnedPab: +totalBurnedPab.toFixed(4),
                    fiatSweptUsd: +totalFiatSwept.toFixed(2),
                },
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=treasury.autonomous.routes.js.map