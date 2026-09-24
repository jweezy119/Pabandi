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
// ── GET /api/v1/venues/search ─────────────────────────────────────────────
router.get('/search', async (req, res, next) => {
    try {
        const { venueService } = await Promise.resolve().then(() => __importStar(require('../services/venue.service')));
        const { city, type, date, capacity, genre, amenities, featured, limit, offset } = req.query;
        const filters = {
            city: city,
            type: type,
            date: date,
            capacity: capacity ? Number(capacity) : undefined,
            genre: genre,
            amenities: amenities ? amenities.split(',') : undefined,
            featured: featured !== undefined ? featured === 'true' : undefined,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
        };
        const venues = await venueService.searchVenues(filters);
        res.json({ success: true, data: venues });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to search venues' });
    }
});
// ── GET /api/v1/venues/featured ───────────────────────────────────────────
router.get('/featured', async (req, res, next) => {
    try {
        const { venueService } = await Promise.resolve().then(() => __importStar(require('../services/venue.service')));
        const { city } = req.query;
        const venues = await venueService.getFeaturedVenues(city);
        res.json({ success: true, data: venues });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to load featured venues' });
    }
});
// ── GET /api/v1/venues/:id ────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
    try {
        const { venueService } = await Promise.resolve().then(() => __importStar(require('../services/venue.service')));
        const venue = await venueService.getVenueById(req.params.id);
        if (!venue) {
            return res.status(404).json({ success: false, error: 'Venue not found' });
        }
        res.json({ success: true, data: venue });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to load venue' });
    }
});
// ── GET /api/v1/venues/:id/availability ───────────────────────────────────
router.get('/:id/availability', async (req, res, next) => {
    try {
        const { venueService } = await Promise.resolve().then(() => __importStar(require('../services/venue.service')));
        const { date } = req.query;
        if (!date) {
            return res.status(400).json({ success: false, error: 'date query parameter is required' });
        }
        const availability = await venueService.getVenueAvailability(req.params.id, date);
        res.json({ success: true, data: availability });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to check availability' });
    }
});
// ── POST /api/v1/venues (admin only) ──────────────────────────────────────
router.post('/', async (req, res, next) => {
    try {
        const { authenticate, authorize } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { venueService } = await Promise.resolve().then(() => __importStar(require('../services/venue.service')));
        // Apply auth middleware inline
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                authorize('ADMIN')(req, res, (err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            });
        });
        const venue = await venueService.createVenue(req.body);
        res.status(201).json({ success: true, data: venue });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to create venue' });
    }
});
// ── PUT /api/v1/venues/:id (admin only) ───────────────────────────────────
router.put('/:id', async (req, res, next) => {
    try {
        const { authenticate, authorize } = await Promise.resolve().then(() => __importStar(require('../middleware/auth.middleware')));
        const { venueService } = await Promise.resolve().then(() => __importStar(require('../services/venue.service')));
        await new Promise((resolve, reject) => {
            authenticate(req, res, (err) => {
                if (err)
                    return reject(err);
                authorize('ADMIN')(req, res, (err) => {
                    if (err)
                        return reject(err);
                    resolve();
                });
            });
        });
        const venue = await venueService.updateVenue(req.params.id, req.body);
        res.json({ success: true, data: venue });
    }
    catch (err) {
        if (err.message?.includes('Authentication') || err.message?.includes('Access denied')) {
            return res.status(401).json({ success: false, error: err.message });
        }
        res.status(500).json({ success: false, error: err.message || 'Failed to update venue' });
    }
});
exports.default = router;
//# sourceMappingURL=venue.routes.js.map