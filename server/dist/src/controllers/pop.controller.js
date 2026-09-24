"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPopEventsForReservation = exports.recordMerchantFulfill = exports.recordMerchantStart = exports.recordPopNoShow = exports.recordPopArrived = exports.recordPopIntent = void 0;
const pop_service_1 = require("../services/pop.service");
const recordPopIntent = async (req, res, next) => {
    try {
        const { userId, reservationId, businessId, meta } = req.body || {};
        if (!userId || !reservationId)
            return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
        const event = await pop_service_1.popService.recordEvent({ userId, reservationId, businessId, eventType: 'INTENT', source: 'buyer', meta });
        res.status(201).json({ success: true, data: event });
    }
    catch (error) {
        next(error);
    }
};
exports.recordPopIntent = recordPopIntent;
const recordPopArrived = async (req, res, next) => {
    try {
        const { userId, reservationId, businessId } = req.body || {};
        if (!userId || !reservationId)
            return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
        const event = await pop_service_1.popService.recordEvent({ userId, reservationId, businessId, eventType: 'ARRIVED', source: 'buyer' });
        res.status(201).json({ success: true, data: event });
    }
    catch (error) {
        next(error);
    }
};
exports.recordPopArrived = recordPopArrived;
const recordPopNoShow = async (req, res, next) => {
    try {
        const { userId, reservationId, businessId } = req.body || {};
        if (!userId || !reservationId)
            return res.status(400).json({ success: false, error: 'userId and reservationId are required' });
        const event = await pop_service_1.popService.recordEvent({ userId, reservationId, businessId, eventType: 'NO_SHOW', source: 'system' });
        res.status(201).json({ success: true, data: event });
    }
    catch (error) {
        next(error);
    }
};
exports.recordPopNoShow = recordPopNoShow;
const recordMerchantStart = async (req, res, next) => {
    try {
        const { merchantId, reservationId, businessId } = req.body || {};
        if (!merchantId || !reservationId)
            return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
        const event = await pop_service_1.popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_START', source: 'merchant' });
        res.status(201).json({ success: true, data: event });
    }
    catch (error) {
        next(error);
    }
};
exports.recordMerchantStart = recordMerchantStart;
const recordMerchantFulfill = async (req, res, next) => {
    try {
        const { merchantId, reservationId, businessId } = req.body || {};
        if (!merchantId || !reservationId)
            return res.status(400).json({ success: false, error: 'merchantId and reservationId are required' });
        const event = await pop_service_1.popService.recordEvent({ userId: merchantId, reservationId, businessId, eventType: 'MERCHANT_FULFILL', source: 'merchant' });
        res.status(201).json({ success: true, data: event });
    }
    catch (error) {
        next(error);
    }
};
exports.recordMerchantFulfill = recordMerchantFulfill;
const getPopEventsForReservation = async (req, res, next) => {
    try {
        const events = await pop_service_1.popService.getEventsForReservation(req.params.reservationId);
        res.status(200).json({ success: true, data: events });
    }
    catch (error) {
        next(error);
    }
};
exports.getPopEventsForReservation = getPopEventsForReservation;
//# sourceMappingURL=pop.controller.js.map