"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const coreBooking_controller_1 = require("../controllers/coreBooking.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// POST /api/v1/bookings/create-with-payment — creates reservation + Square checkout
router.post('/create-with-payment', auth_middleware_1.authenticate, coreBooking_controller_1.createWithPayment);
// GET /api/v1/bookings/confirm-payment — Square redirect URL (no auth required for redirect)
router.get('/confirm-payment', coreBooking_controller_1.confirmPayment);
// POST /api/v1/bookings/checkin — check-in with QR scan / host verification
router.post('/checkin', coreBooking_controller_1.checkin);
// GET /api/v1/bookings/status/:bookingRef — poll booking status
router.get('/status/:bookingRef', coreBooking_controller_1.getBookingStatus);
exports.default = router;
//# sourceMappingURL=coreBooking.routes.js.map