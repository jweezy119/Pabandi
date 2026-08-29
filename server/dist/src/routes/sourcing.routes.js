"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const sourcing_controller_1 = require("../controllers/sourcing.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/analyze', sourcing_controller_1.analyzeDemand);
router.post('/order/:orderId/confirm', sourcing_controller_1.confirmOrder);
router.post('/consult', sourcing_controller_1.consultAdvisor);
// New Trend-to-Service endpoints
router.get('/trends', sourcing_controller_1.getTrends);
router.post('/trends/:trendId/launch', sourcing_controller_1.launchService);
exports.default = router;
//# sourceMappingURL=sourcing.routes.js.map