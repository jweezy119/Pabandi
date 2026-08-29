"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reliability_controller_1 = require("../controllers/reliability.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Publicly accessible guidelines
router.get('/guidelines', reliability_controller_1.getGuidelines);
// Authenticated history
router.get('/history', auth_middleware_1.authenticate, reliability_controller_1.getHistory);
exports.default = router;
//# sourceMappingURL=reliability.routes.js.map