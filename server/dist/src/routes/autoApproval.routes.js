"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const autoApproval_controller_1 = require("../controllers/autoApproval.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/status', auth_middleware_1.authenticate, autoApproval_controller_1.getAutoApprovalStatus);
router.get('/balance', auth_middleware_1.authenticate, autoApproval_controller_1.getPlatformBalance);
router.post('/transfer', auth_middleware_1.authenticate, autoApproval_controller_1.autoTransfer);
router.post('/generate-wallet', auth_middleware_1.authenticate, autoApproval_controller_1.generateNewWallet);
router.get('/history', auth_middleware_1.authenticate, autoApproval_controller_1.getTransferHistory);
exports.default = router;
//# sourceMappingURL=autoApproval.routes.js.map