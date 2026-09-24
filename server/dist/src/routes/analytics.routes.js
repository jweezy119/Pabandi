"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const analytics_controller_1 = require("../controllers/analytics.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
router.get('/', (0, auth_middleware_1.authorize)('BUSINESS_OWNER', 'ADMIN'), analytics_controller_1.getAnalytics);
router.get('/detailed', (0, auth_middleware_1.authorize)('BUSINESS_OWNER', 'ADMIN'), analytics_controller_1.getDetailedAnalytics);
exports.default = router;
//# sourceMappingURL=analytics.routes.js.map