"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const codEscrow_service_1 = require("../services/codEscrow.service");
const router = (0, express_1.Router)();
// POST /api/v1/cod/create
router.post('/create', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const sellerId = req.user?.id;
        const { buyerId, amount, description, shippingAddress } = req.body;
        if (!buyerId || !amount || !description) {
            return res.status(400).json({ error: 'buyerId, amount, description are required' });
        }
        const escrow = await codEscrow_service_1.codEscrowService.createEscrow(sellerId, buyerId, {
            amount: parseFloat(amount),
            description,
            shippingAddress,
        });
        res.status(201).json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/cod/:id/pay
router.post('/:id/pay', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const escrow = await codEscrow_service_1.codEscrowService.payIntoEscrow(req.params.id);
        res.json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/cod/:id/ship
router.post('/:id/ship', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { trackingNumber } = req.body;
        if (!trackingNumber)
            return res.status(400).json({ error: 'trackingNumber is required' });
        const escrow = await codEscrow_service_1.codEscrowService.confirmShipment(req.params.id, trackingNumber);
        res.json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/cod/:id/deliver
router.post('/:id/deliver', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const escrow = await codEscrow_service_1.codEscrowService.confirmDelivery(req.params.id);
        res.json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/cod/:id/release
router.post('/:id/release', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const escrow = await codEscrow_service_1.codEscrowService.releaseFunds(req.params.id);
        res.json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/cod/:id/dispute
router.post('/:id/dispute', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { reason } = req.body;
        if (!reason)
            return res.status(400).json({ error: 'reason is required' });
        const escrow = await codEscrow_service_1.codEscrowService.raiseDispute(req.params.id, reason);
        res.json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// POST /api/v1/cod/:id/resolve
router.post('/:id/resolve', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { resolution } = req.body;
        if (!resolution || !['REFUND', 'RELEASE'].includes(resolution)) {
            return res.status(400).json({ error: 'resolution must be REFUND or RELEASE' });
        }
        const escrow = await codEscrow_service_1.codEscrowService.resolveDispute(req.params.id, resolution);
        res.json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/cod/history
router.get('/history', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const history = await codEscrow_service_1.codEscrowService.getEscrowHistory(userId);
        res.json({ success: true, data: history });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// GET /api/v1/cod/:id
router.get('/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const escrow = await codEscrow_service_1.codEscrowService.getEscrowById(req.params.id);
        if (!escrow)
            return res.status(404).json({ error: 'Escrow not found' });
        res.json({ success: true, data: escrow });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=codEscrow.routes.js.map