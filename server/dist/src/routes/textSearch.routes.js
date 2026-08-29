"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
const CACHE_TTL_MS = 60000;
const cache = new Map();
const getCached = (key, fallback) => {
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
        return Promise.resolve(cached.data);
    }
    return fallback().then((data) => {
        cache.set(key, { data, expiresAt: now + CACHE_TTL_MS });
        return data;
    });
};
const suggestFromNominatim = async (query) => {
    const normalized = String(query).trim();
    if (!normalized)
        return [];
    // Open-source, key-free geocoder (OpenStreetMap Nominatim). Respectful usage:
    // a real User-Agent + a single small request. Falls back to [] on any failure.
    const url = 'https://nominatim.openstreetmap.org/search';
    try {
        const res = await axios_1.default.get(url, {
            params: { q: normalized, format: 'json', limit: 8, addressdetails: 0 },
            headers: { 'User-Agent': 'PabandiApp/1.0 (contact@pabandi.app)' },
            timeout: 5000,
        });
        const items = Array.isArray(res.data) ? res.data : [];
        const out = [];
        for (const item of items) {
            const name = item?.name || item?.display_name?.split(',')[0];
            if (typeof name === 'string' && name.trim())
                out.push(name.trim());
        }
        return out.slice(0, 8);
    }
    catch {
        return [];
    }
};
router.get('/text-search/suggestions', async (req, res) => {
    try {
        const query = req.query.q || '';
        if (!query || query.length < 2) {
            return res.status(200).json({ success: true, data: { suggestions: [] } });
        }
        const key = `q:${query.toLowerCase()}`;
        const suggestions = await getCached(key, () => suggestFromNominatim(query));
        return res.status(200).json({ success: true, data: { suggestions } });
    }
    catch (error) {
        console.error('[TextSearch] suggestions error:', error);
        return res.status(200).json({ success: true, data: { suggestions: [] } });
    }
});
router.get('/text-search/categories', async (req, res) => {
    try {
        const suggestions = [
            'Restaurants',
            'Cafes',
            'Salons',
            'Clinics',
            'Spas',
            'Fitness centers',
            'Live sellers',
            'Freelancers',
            'Short-term rentals',
            'Photographers',
            'Event planners',
            'Tutors',
        ];
        const filtered = suggestions.filter((s) => (req.query.q || '').trim().length
            ? s.toLowerCase().includes(req.query.q.trim().toLowerCase())
            : true);
        return res.status(200).json({ success: true, data: { suggestions: filtered.slice(0, 12) } });
    }
    catch (error) {
        console.error('[TextSearch] categories error:', error);
        return res.status(200).json({ success: true, data: { suggestions: [] } });
    }
});
exports.default = router;
//# sourceMappingURL=textSearch.routes.js.map