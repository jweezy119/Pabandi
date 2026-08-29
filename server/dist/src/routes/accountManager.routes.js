"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const accountManager_controller_1 = require("../controllers/accountManager.controller");
// import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'; 
// Assuming auth middleware exists, placeholder imports used here.
const router = (0, express_1.Router)();
// In a real implementation, you would use auth middlewares like so:
// router.post('/admin/account-managers', authenticateToken, requireAdmin, accountManagerController.createPartner);
// router.put('/admin/account-managers/config', authenticateToken, requireAdmin, accountManagerController.updateConfig);
// router.get('/me', authenticateToken, accountManagerController.getMe);
// router.get('/referrals', authenticateToken, accountManagerController.getReferrals);
// router.get('/ledger', authenticateToken, accountManagerController.getLedger);
// router.get('/payouts', authenticateToken, accountManagerController.getPayouts);
router.post('/admin', accountManager_controller_1.accountManagerController.createPartner);
router.put('/admin/config', accountManager_controller_1.accountManagerController.updateConfig);
router.get('/me', accountManager_controller_1.accountManagerController.getMe);
router.get('/referrals', accountManager_controller_1.accountManagerController.getReferrals);
router.get('/ledger', accountManager_controller_1.accountManagerController.getLedger);
router.get('/payouts', accountManager_controller_1.accountManagerController.getPayouts);
exports.default = router;
//# sourceMappingURL=accountManager.routes.js.map