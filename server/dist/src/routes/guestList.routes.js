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
const router = (0, express_1.Router)();
// ── POST /api/v1/guest-list (auth required) ───────────────────────────────
router.post('/', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { guestListService } = await Promise.resolve().then(() => __importStar(require('../services/guestList.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const entry = await guestListService.addToGuestList({
            userId,
            ...req.body,
        });
        res.status(201).json({ success: true, data: entry });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(400).json({ success: false, error: err.message || 'Failed to add to guest list' });
    }
});
// ── GET /api/v1/guest-list/my-entries (auth required) ─────────────────────
router.get('/my-entries', async (req, res, next) => {
    try {
        const { authenticate } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { guestListService } = await Promise.resolve().then(() => __importStar(require('../services/guestList.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        const userId = req.user?.id;
        const entries = await guestListService.getGuestListByUser(userId);
        res.json({ success: true, data: entries });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('token')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load entries' });
    }
});
// ── GET /api/v1/guest-list/venue/:venueId (admin/business only) ───────────
router.get('/venue/:venueId', async (req, res, next) => {
    try {
        const { authenticate, authorize } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { guestListService } = await Promise.resolve().then(() => __importStar(require('../services/guestList.service')));
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
        const { date } = req.query;
        const guestList = await guestListService.getGuestList(req.params.venueId, date);
        res.json({ success: true, data: guestList });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to load guest list' });
    }
});
// ── POST /api/v1/guest-list/:id/confirm ───────────────────────────────────
router.post('/:id/confirm', async (req, res, next) => {
    try {
        const { guestListService } = await Promise.resolve().then(() => __importStar(require('../services/guestList.service')));
        const entry = await guestListService.confirmGuestListEntry(req.params.id);
        res.json({ success: true, data: entry });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message || 'Failed to confirm entry' });
    }
});
// ── POST /api/v1/guest-list/:id/check-in ──────────────────────────────────
router.post('/:id/check-in', async (req, res, next) => {
    try {
        const { guestListService } = await Promise.resolve().then(() => __importStar(require('../services/guestList.service')));
        const entry = await guestListService.checkInGuest(req.params.id);
        res.json({ success: true, data: entry });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message || 'Failed to check in guest' });
    }
});
// ── POST /api/v1/guest-list/:id/cancel ────────────────────────────────────
router.post('/:id/cancel', async (req, res, next) => {
    try {
        const { guestListService } = await Promise.resolve().then(() => __importStar(require('../services/guestList.service')));
        const entry = await guestListService.cancelGuestListEntry(req.params.id);
        res.json({ success: true, data: entry });
    }
    catch (err) {
        res.status(400).json({ success: false, error: err.message || 'Failed to cancel entry' });
    }
});
exports.default = router;
//# sourceMappingURL=guestList.routes.js.map