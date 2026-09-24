"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const leasePab_service_1 = require("../services/leasePab.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const logger_1 = require("../utils/logger");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// ── Lease PAB Deposit ─────────────────────────────────────────────────────────
// POST /api/v1/lease-pab/deposit
router.post('/deposit', async (req, res) => {
    try {
        const { leaseId, depositAmount } = req.body;
        if (!leaseId || !depositAmount) {
            return res.status(400).json({ error: 'leaseId and depositAmount required' });
        }
        const result = await leasePab_service_1.leasePabService.createLeaseWithPabDeposit({
            leaseId,
            tenantEmail: req.body.tenantEmail,
            depositAmount,
            userId: req.user.id,
        });
        res.status(result.success ? 201 : 400).json(result);
    }
    catch (e) {
        logger_1.logger.error('[LeasePabRoutes] deposit failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/lease-pab/deposit/:leaseId
router.get('/deposit/:leaseId', async (req, res) => {
    try {
        const result = await leasePab_service_1.leasePabService.getLeaseDepositStatus(req.params.leaseId);
        if (!result)
            return res.status(404).json({ error: 'Deposit not found' });
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[LeasePabRoutes] get deposit failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/v1/lease-pab/release/:leaseId
router.post('/release/:leaseId', async (req, res) => {
    try {
        const { earlyTermination } = req.body;
        const result = await leasePab_service_1.leasePabService.returnLeaseDeposit({
            leaseId: req.params.leaseId,
            userId: req.user.id,
            earlyTermination: !!earlyTermination,
        });
        res.json(result);
    }
    catch (e) {
        logger_1.logger.error('[LeasePabRoutes] release failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── PAB Payment ────────────────────────────────────────────────────────────────
// POST /api/v1/lease-pab/pay-rent
router.post('/pay-rent', async (req, res) => {
    try {
        const { rentPaymentId, propertyId, unitId, tokenUsed, amountUsdc, tenantEmail } = req.body;
        if (!rentPaymentId || !propertyId || !tokenUsed || !amountUsdc) {
            return res.status(400).json({ error: 'rentPaymentId, propertyId, tokenUsed, amountUsdc required' });
        }
        const result = await leasePab_service_1.leasePabService.processPabPayment({
            rentPaymentId,
            tenantEmail: tenantEmail || req.user.email,
            propertyId,
            unitId,
            amountUsdc,
            tokenUsed,
            userId: req.user.id,
        });
        res.status(result.success ? 201 : 400).json(result);
    }
    catch (e) {
        logger_1.logger.error('[LeasePabRoutes] pay-rent failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/lease-pab/payment-history
router.get('/payment-history', async (req, res) => {
    try {
        const { tenantEmail } = req.query;
        const email = tenantEmail || req.user.email;
        const result = await leasePab_service_1.leasePabService.getPaymentHistory(email);
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[LeasePabRoutes] payment-history failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Agent PAB Rewards ──────────────────────────────────────────────────────────
// POST /api/v1/lease-pab/agent-reward
router.post('/agent-reward', async (req, res) => {
    try {
        const { agentId, taskType, taskDescription, propertyId, unitId, tenantEmail, rewardAmount, autoConvert } = req.body;
        if (!agentId || !taskType || !taskDescription || !rewardAmount) {
            return res.status(400).json({ error: 'agentId, taskType, taskDescription, rewardAmount required' });
        }
        const result = await leasePab_service_1.leasePabService.rewardAgentForTask({
            agentId,
            taskType,
            taskDescription,
            propertyId,
            unitId,
            tenantEmail,
            rewardAmount,
            autoConvert: !!autoConvert,
        });
        res.status(result.success ? 201 : 400).json(result);
    }
    catch (e) {
        logger_1.logger.error('[LeasePabRoutes] agent-reward failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// GET /api/v1/lease-pab/agent-earnings/:agentId
router.get('/agent-earnings/:agentId', async (req, res) => {
    try {
        const result = await leasePab_service_1.leasePabService.getAgentPabEarnings(req.params.agentId);
        if (!result.agent)
            return res.status(404).json({ error: 'Agent not found' });
        res.json({ success: true, data: result });
    }
    catch (e) {
        logger_1.logger.error('[LeasePabRoutes] agent-earnings failed:', e.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=leasePab.routes.js.map