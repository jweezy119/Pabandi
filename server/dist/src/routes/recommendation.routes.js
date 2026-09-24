"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const recommendation_service_1 = require("../services/recommendation.service");
const router = (0, express_1.Router)();
// Property recommendations
router.get('/properties', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const properties = [
            { id: '1', name: 'Downtown Loft', monthlyRent: 1500, minTrustScore: 0 },
            { id: '2', name: 'Suburban House', monthlyRent: 2200, minTrustScore: 200 },
            { id: '3', name: 'Luxury Penthouse', monthlyRent: 5000, minTrustScore: 500 },
        ];
        const result = await recommendation_service_1.recommendationEngine.recommendProperties(req.user.id, properties);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Trust tier recommendation
router.get('/trust-tier', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await recommendation_service_1.recommendationEngine.recommendTrustTier(req.user.id);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Payment method recommendation
router.post('/payment-method', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { amount } = req.body;
        const result = await recommendation_service_1.recommendationEngine.recommendPaymentMethod(req.user.id, amount);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
// Next feature recommendation (for onboarding)
router.get('/next-feature', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const result = await recommendation_service_1.recommendationEngine.recommendNextFeature(req.user.id);
        res.json({ success: true, data: result });
    }
    catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=recommendation.routes.js.map