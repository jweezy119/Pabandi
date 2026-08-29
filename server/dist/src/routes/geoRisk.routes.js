"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * geoRisk.routes.ts — Geospatial Risk Oracle HTTP surface.
 * Public, stateless: assess a property's intrinsic risk + compute dual-risk rent.
 */
const express_1 = require("express");
const geoRiskOracle_service_1 = require("../services/geoRiskOracle.service");
const router = (0, express_1.Router)();
const BANDS = ['A', 'B', 'C', 'D', 'E'];
/** POST /api/v1/geo/assess — assess a property's intrinsic (location) risk. */
router.post('/assess', async (req, res) => {
    const { lat, lng, address, floodZone, crimeRatePer1k, schoolRating } = req.body || {};
    if (lat === undefined && lng === undefined && !address) {
        return res.status(400).json({ success: false, error: 'Provide lat/lng or address' });
    }
    try {
        const result = geoRiskOracle_service_1.geoRiskOracle.assessProperty({ lat, lng, address, floodZone, crimeRatePer1k, schoolRating });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
/** GET /api/v1/geo/assess?address=... convenience */
router.get('/assess', async (req, res) => {
    const { lat, lng, address } = req.query;
    if (!lat && !lng && !address) {
        return res.status(400).json({ success: false, error: 'Provide lat/lng or address' });
    }
    try {
        const result = geoRiskOracle_service_1.geoRiskOracle.assessProperty({
            lat: lat ? Number(lat) : undefined,
            lng: lng ? Number(lng) : undefined,
            address,
        });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
/**
 * POST /api/v1/geo/price-rent — dual-risk dynamic rent.
 * Body: { baseRentUSD, geoRiskBand, tenantTrustBand }
 */
router.post('/price-rent', async (req, res) => {
    const { baseRentUSD, geoRiskBand, tenantTrustBand } = req.body || {};
    if (typeof baseRentUSD !== 'number' || !BANDS.includes(geoRiskBand) || !BANDS.includes(tenantTrustBand)) {
        return res.status(400).json({ success: false, error: 'baseRentUSD (number), geoRiskBand & tenantTrustBand (A-E) required' });
    }
    try {
        const result = geoRiskOracle_service_1.geoRiskOracle.priceWithDualRisk({ baseRentUSD, geoRiskBand, tenantTrustBand });
        res.json({ success: true, data: result });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=geoRisk.routes.js.map