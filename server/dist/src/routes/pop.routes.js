"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const pop_service_1 = require("../services/pop.service");
const router = (0, express_1.Router)();
router.post('/intent', async (req, res) => {
    const { userId, reservationId, businessId, meta } = req.body || {};
    if (!userId || !reservationId)
        return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
    const event = await pop_service_1.popService.recordEvent({ userId, reservationId, businessId, eventType: 'INTENT', source: 'buyer', meta });
    res.status(201).json({ success: true, data: event });
});
router.post('/arrived', async (req, res) => {
    const { userId, reservationId, businessId } = req.body || {};
    if (!userId || !reservationId)
        return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
    const event = await pop_service_1.popService.recordEvent({ userId, reservationId, businessId, eventType: 'ARRIVED', source: 'buyer' });
    res.status(201).json({ success: true, data: event });
});
router.post('/no-show', async (req, res) => {
    const { userId, reservationId, businessId } = req.body || {};
    if (!userId || !reservationId)
        return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
    const event = await pop_service_1.popService.recordEvent({ userId, reservationId, businessId, eventType: 'NO_SHOW', source: 'system' });
    res.status(201).json({ success: true, data: event });
});
router.post('/merchant/start', async (req, res) => {
    const { merchantId, reservationId, businessId } = req.body || {};
    if (!merchantId || !reservationId)
        return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
    const event = await pop_service_1.popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_START', source: 'merchant' });
    res.status(201).json({ success: true, data: event });
});
router.post('/merchant/fulfill', async (req, res) => {
    const { merchantId, reservationId, businessId } = req.body || {};
    if (!merchantId || !reservationId)
        return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
    const event = await pop_service_1.popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_FULFILL', source: 'merchant' });
    res.status(201).json({ success: true, data: event });
});
router.get('/reservation/:reservationId', async (req, res) => {
    const events = await pop_service_1.popService.getEventsForReservation(req.params.reservationId);
    res.status(200).json({ success: true, data: events });
});
exports.default = router;
//# sourceMappingURL=pop.routes.js.map