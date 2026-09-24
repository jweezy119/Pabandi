"use strict";
/**
 * Maps Routes - Geocoding and Location Services
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const maps_service_1 = require("../services/maps.service");
const logger_1 = require("../utils/logger");
const axios_1 = __importDefault(require("axios"));
const router = (0, express_1.Router)();
// =============================================
// Geocode address to coordinates
// GET /api/v1/maps/geocode?address=
// =============================================
router.get('/geocode', async (req, res, next) => {
    try {
        const { address, q } = req.query;
        const searchAddress = (address || q);
        if (!searchAddress) {
            return res.status(400).json({ success: false, error: 'address parameter is required' });
        }
        const results = await maps_service_1.mapsService.geocode(searchAddress);
        res.json({ success: true, data: results });
    }
    catch (error) {
        logger_1.logger.error(`[Maps Routes] Geocode error: ${error.message}`);
        next(error);
    }
});
// =============================================
// Reverse geocode coordinates to address
// GET /api/v1/maps/reverse?lat=&lon=
// =============================================
router.get('/reverse', async (req, res, next) => {
    try {
        const { lat, lon, lng } = req.query;
        if (!lat || (!lon && !lng)) {
            return res.status(400).json({ success: false, error: 'lat and lon/lng parameters are required' });
        }
        const result = await maps_service_1.mapsService.reverseGeocode(parseFloat(lat), parseFloat((lon || lng)));
        res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error(`[Maps Routes] Reverse error: ${error.message}`);
        next(error);
    }
});
// =============================================
// Find nearby places
// GET /api/v1/maps/nearby?lat=&lon=&category=&radius=
// =============================================
router.get('/nearby', async (req, res, next) => {
    try {
        const { lat, lon, lng, category, radius, limit } = req.query;
        if (!lat || (!lon && !lng)) {
            return res.status(400).json({ success: false, error: 'lat and lon/lng parameters are required' });
        }
        const results = await maps_service_1.mapsService.nearby(parseFloat(lat), parseFloat((lon || lng)), category, radius ? parseInt(radius) : 5000, limit ? parseInt(limit) : 20);
        res.json({ success: true, data: results });
    }
    catch (error) {
        logger_1.logger.error(`[Maps Routes] Nearby error: ${error.message}`);
        next(error);
    }
});
// =============================================
// Calculate travel distance
// GET /api/v1/maps/distance?from=&to=&mode=
// =============================================
router.get('/distance', async (req, res, next) => {
    try {
        const { from, to, mode } = req.query;
        if (!from || !to) {
            return res.status(400).json({ success: false, error: 'from and to parameters are required' });
        }
        const result = await maps_service_1.mapsService.distance(from, to, mode || 'driving');
        res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error(`[Maps Routes] Distance error: ${error.message}`);
        next(error);
    }
});
// =============================================
// Get turn-by-turn directions
// GET /api/v1/maps/directions?from=&to=&mode=
// =============================================
router.get('/directions', async (req, res, next) => {
    try {
        const { from, to, mode } = req.query;
        if (!from || !to) {
            return res.status(400).json({ success: false, error: 'from and to parameters are required' });
        }
        const result = await maps_service_1.mapsService.directions(from, to, mode || 'driving');
        res.json({ success: true, data: result });
    }
    catch (error) {
        logger_1.logger.error(`[Maps Routes] Directions error: ${error.message}`);
        next(error);
    }
});
// =============================================
// Search businesses in database
// GET /api/v1/maps/businesses?lat=&lng=&category=&radius=
// =============================================
router.get('/businesses', async (req, res, next) => {
    try {
        const { lat, lng, category, radius } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ success: false, error: 'lat and lng parameters are required' });
        }
        const results = await maps_service_1.mapsService.searchNearbyBusinesses(parseFloat(lat), parseFloat(lng), category, radius ? parseInt(radius) : 5000);
        res.json({ success: true, data: results });
    }
    catch (error) {
        logger_1.logger.error(`[Maps Routes] Businesses error: ${error.message}`);
        next(error);
    }
});
// =============================================
// Get timezone for coordinates
// GET /api/v1/maps/timezone?lat=&lng=
// =============================================
router.get('/timezone', async (req, res, next) => {
    try {
        const { lat, lng } = req.query;
        if (!lat || !lng) {
            return res.status(400).json({ success: false, error: 'lat and lng parameters are required' });
        }
        const response = await axios_1.default.get('https://timeapi.io/api/TimeZone/coordinate', {
            params: { latitude: lat, longitude: lng },
        });
        res.json({
            success: true,
            data: {
                timezone: response.data.timeZone,
                utcOffset: response.data.currentUtcOffset,
                localTime: response.data.time,
            },
        });
    }
    catch (error) {
        logger_1.logger.error(`[Maps Routes] Timezone error: ${error.message}`);
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=maps.routes.js.map