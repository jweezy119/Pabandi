"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const solanaUsdc_controller_1 = require("../controllers/solanaUsdc.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/platform-balance', auth_middleware_1.authenticate, solanaUsdc_controller_1.getPlatformBalance);
router.get('/transfers', auth_middleware_1.authenticate, solanaUsdc_controller_1.getTransfers);
router.get('/agent-wallets', auth_middleware_1.authenticate, solanaUsdc_controller_1.getAgentWallets);
router.post('/transfer/build', auth_middleware_1.authenticate, solanaUsdc_controller_1.buildTransfer);
router.post('/transfer/record', auth_middleware_1.authenticate, solanaUsdc_controller_1.recordTransfer);
router.post('/agents/:agentId/wallet', auth_middleware_1.authenticate, solanaUsdc_controller_1.createAgentWallet);
router.get('/agents/:agentId/balance', auth_middleware_1.authenticate, solanaUsdc_controller_1.getAgentBalance);
exports.default = router;
//# sourceMappingURL=solanaUsdc.routes.js.map