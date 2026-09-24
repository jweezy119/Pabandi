"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const safOS_service_1 = require("../services/safOS.service");
const router = (0, express_1.Router)();
// Loads
router.get('/loads', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status, originCity, destCity, cargoType } = req.query;
        const loads = await safOS_service_1.safLoad.getLoads({ status: status, originCity: originCity, destCity: destCity, cargoType: cargoType });
        res.json({ success: true, data: loads });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get loads' });
    }
});
router.get('/loads/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const load = await safOS_service_1.safLoad.getLoadDetail(req.params.id);
        if (!load)
            return res.status(404).json({ error: 'Load not found' });
        res.json({ success: true, data: load });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get load details' });
    }
});
router.post('/loads', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const load = await safOS_service_1.safLoad.postLoad({ ...req.body, shipperId: userId });
        res.status(201).json({ success: true, data: load });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to post load' });
    }
});
router.put('/loads/:id/status', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status } = req.body;
        const load = await safOS_service_1.safLoad.updateLoadStatus(req.params.id, status);
        res.json({ success: true, data: load });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to update load status' });
    }
});
router.delete('/loads/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        await safOS_service_1.safLoad.deleteLoad(req.params.id);
        res.json({ success: true, message: 'Load deleted' });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to delete load' });
    }
});
// Carriers
router.get('/carriers', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { verified, state } = req.query;
        const carriers = await safOS_service_1.safCarrier.getCarriers({ verified: verified === 'true' ? true : verified === 'false' ? false : undefined, state: state });
        res.json({ success: true, data: carriers });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get carriers' });
    }
});
router.get('/carriers/:id', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const carrier = await safOS_service_1.safCarrier.getCarrierDetail(req.params.id);
        if (!carrier)
            return res.status(404).json({ error: 'Carrier not found' });
        res.json({ success: true, data: carrier });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get carrier details' });
    }
});
router.post('/carriers', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const carrier = await safOS_service_1.safCarrier.registerCarrier({ ...req.body, userId });
        res.status(201).json({ success: true, data: carrier });
    }
    catch (e) {
        res.status(500).json({ error: e.message || 'Failed to register carrier' });
    }
});
router.post('/carriers/:id/rate', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { rating, review } = req.body;
        const carrier = await safOS_service_1.safCarrier.rateCarrier(req.params.id, rating, review);
        res.json({ success: true, data: carrier });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to rate carrier' });
    }
});
// Matching
router.post('/match', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { loadId } = req.body;
        const matches = await safOS_service_1.safMatching.matchLoadToCarrier(loadId);
        res.json({ success: true, data: matches });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to match load' });
    }
});
router.post('/accept', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { carrierId, loadId, amountUsd } = req.body;
        const bid = await safOS_service_1.safMatching.acceptLoad(carrierId, loadId, amountUsd);
        res.json({ success: true, data: bid });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to accept load' });
    }
});
router.get('/matching-history', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const history = await safOS_service_1.safMatching.getMatchingHistory(userId);
        res.json({ success: true, data: history });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get matching history' });
    }
});
// Rates
router.get('/rates', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const distance = Number(req.query.distance) || 0;
        const weight = Number(req.query.weight) || 0;
        const type = req.query.type || 'GENERAL';
        const rate = await safOS_service_1.safRate.calculateRate(distance, weight, type);
        res.json({ success: true, data: rate });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to calculate rate' });
    }
});
router.get('/rates/history', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const userId = req.user?.id;
        const history = await safOS_service_1.safRate.getRateHistory(userId);
        res.json({ success: true, data: history });
    }
    catch (e) {
        res.status(500).json({ error: 'Failed to get rate history' });
    }
});
exports.default = router;
//# sourceMappingURL=safOS.routes.js.map