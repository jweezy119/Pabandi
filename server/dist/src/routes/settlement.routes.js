"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const settlement_controller_1 = require("../controllers/settlement.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/status', auth_middleware_1.authenticate, settlement_controller_1.getSettlementStatus);
router.post('/run', auth_middleware_1.authenticate, settlement_controller_1.runSettlement);
exports.default = router;
//# sourceMappingURL=settlement.routes.js.map