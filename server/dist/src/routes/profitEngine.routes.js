"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const profitEngine_controller_1 = require("../controllers/profitEngine.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/report', auth_middleware_1.authenticate, profitEngine_controller_1.getProfitReport);
router.post('/cycle', auth_middleware_1.authenticate, profitEngine_controller_1.runManualCycle);
router.get('/arbitrage', auth_middleware_1.authenticate, profitEngine_controller_1.getArbitrageStatus);
router.get('/settlement', profitEngine_controller_1.getSettlementSpeed);
router.get('/learning', auth_middleware_1.authenticate, profitEngine_controller_1.getLearningLog);
exports.default = router;
//# sourceMappingURL=profitEngine.routes.js.map