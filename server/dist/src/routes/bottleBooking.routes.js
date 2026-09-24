"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookingWithPayment_controller_1 = require("../controllers/bookingWithPayment.controller");
const router = (0, express_1.Router)();
// ── POST /api/v1/bookings/create-with-payment ────────────────────────────
router.post('/create-with-payment', async (req, res, next) => {
    try {
        await (0, bookingWithPayment_controller_1.createBookingWithPayment)(req, res, next);
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message || 'Failed to create booking' });
    }
});
// ── POST /api/v1/bookings/confirm-payment ────────────────────────────────
router.post('/confirm-payment', async (req, res, next) => {
    try {
        await (0, bookingWithPayment_controller_1.confirmPaymentAndIssueRewards)(req, res, next);
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message || 'Failed to confirm payment' });
    }
});
// ── GET /api/v1/bookings/confirm-payment ────────────────────────────────
// Square sends a browser GET redirect after payment — process and redirect to frontend.
router.get('/confirm-payment', async (req, res, next) => {
    try {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const ref = req.query.ref;
        const paymentId = req.query.paymentId;
        const demo = req.query.demo === 'true';
        if (!ref) {
            return res.redirect(`${frontendUrl}/sitara/book?pay=error&reason=missing_ref`);
        }
        // Build a synthetic POST-style request and call the core logic
        const syntheticReq = {
            method: 'POST',
            body: { ref, paymentId, demo },
            query: req.query,
            headers: req.headers,
            protocol: req.protocol,
            get: req.get,
        };
        let capturedResult = null;
        const fakeRes = {
            status: () => fakeRes,
            json: (data) => { capturedResult = data; return data; },
        };
        await (0, bookingWithPayment_controller_1.confirmPaymentAndIssueRewards)(syntheticReq, fakeRes, next);
        if (capturedResult?.success) {
            const bookingRef = capturedResult.data?.bookingRef || ref;
            return res.redirect(`${frontendUrl}/sitara/book/confirmed?ref=${bookingRef}`);
        }
        return res.redirect(`${frontendUrl}/sitara/book?pay=failed`);
    }
    catch (err) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/sitara/book?pay=error`);
    }
});
// ── POST /api/v1/bookings/checkin ─────────────────────────────────────────
router.post('/checkin', async (req, res, next) => {
    try {
        await (0, bookingWithPayment_controller_1.checkInAndReleaseEscrow)(req, res, next);
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message || 'Failed to check in' });
    }
});
// ── POST /api/v1/bookings/bottle (auth required) ──────────────────────────
router.post('/bottle', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { bottleBookingService } = await Promise.resolve().then(() => __importStar(require('../services/bottleBooking.service')));
        // Apply auth middleware inline
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const booking = await bottleBookingService.createBooking({
            userId,
            ...req.body,
        });
        res.status(201).json({ success: true, data: booking });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(400).json({ success: false, error: err.message || 'Failed to create booking' });
    }
});
// ── GET /api/v1/bookings/my-bookings (auth required) ──────────────────────
router.get('/my-bookings', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { bottleBookingService } = await Promise.resolve().then(() => __importStar(require('../services/bottleBooking.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const bookings = await bottleBookingService.getUserBookings(userId);
        res.json({ success: true, data: bookings });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load bookings' });
    }
});
// ── GET /api/v1/bookings/:id (auth required) ──────────────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { bottleBookingService } = await Promise.resolve().then(() => __importStar(require('../services/bottleBooking.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const booking = await bottleBookingService.getBookingById(req.params.id);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found' });
        }
        res.json({ success: true, data: booking });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load booking' });
    }
});
// ── POST /api/v1/bookings/:id/cancel (auth required) ──────────────────────
router.post('/:id/cancel', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { bottleBookingService } = await Promise.resolve().then(() => __importStar(require('../services/bottleBooking.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const booking = await bottleBookingService.cancelBooking(req.params.id);
        res.json({ success: true, data: booking });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(400).json({ success: false, error: err.message || 'Failed to cancel booking' });
    }
});
// ── POST /api/v1/bookings/:id/check-in (admin/business only) ──────────────
router.post('/:id/check-in', async (req, res, next) => {
    try {
        const { authenticate, authorize } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { bottleBookingService } = await Promise.resolve().then(() => __importStar(require('../services/bottleBooking.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                authorize('ADMIN', 'BUSINESS_OWNER', 'BUSINESS_STAFF')(req, res, (err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            });
        });
        const staffId = req.user?.id;
        const booking = await bottleBookingService.checkInBooking(req.params.id, staffId);
        res.json({ success: true, data: booking });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(400).json({ success: false, error: err.message || 'Failed to check in booking' });
    }
});
exports.default = router;
//# sourceMappingURL=bottleBooking.routes.js.map