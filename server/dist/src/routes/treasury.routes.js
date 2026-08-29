"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const treasury_controller_1 = require("../controllers/treasury.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const auth_middleware_2 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/summary', auth_middleware_1.authenticate, (0, auth_middleware_2.authorize)('ADMIN'), treasury_controller_1.getSummary);
router.post('/tribute', auth_middleware_1.authenticate, (0, auth_middleware_2.authorize)('ADMIN'), treasury_controller_1.createTribute);
exports.default = router;
//# sourceMappingURL=treasury.routes.js.map