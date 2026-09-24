"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const checkin_service_1 = require("../services/checkin.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Generate check-in QR code for a reservation
router.post('/:reservationId/qr', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { reservationId } = req.params;
        const result = await checkin_service_1.checkInService.generateCheckInToken(reservationId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Verify check-in (can be called by staff scanning QR or customer entering code manually)
router.post('/verify', async (req, res, next) => {
    try {
        const { code, reservationId, lat, lng, method } = req.body;
        const result = await checkin_service_1.checkInService.verifyCheckIn({
            code,
            reservationId,
            lat,
            lng,
            method: method || 'manual',
            verifiedBy: req?.user?.id,
        });
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Check out
router.post('/:reservationId/checkout', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { reservationId } = req.params;
        const result = await checkin_service_1.checkInService.checkOut(reservationId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Get check-in history
router.get('/:reservationId/history', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { reservationId } = req.params;
        const result = await checkin_service_1.checkInService.getCheckInHistory(reservationId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// Get active check-ins for a business
router.get('/business/:businessId/active', auth_middleware_1.authenticate, async (req, res, next) => {
    try {
        const { businessId } = req.params;
        const result = await checkin_service_1.checkInService.getActiveCheckIns(businessId);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=checkin.routes.js.map