"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const accountManager_controller_1 = require("../controllers/accountManager.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public, unauthenticated: validate a referral code for the /r/:code share landing.
router.get('/validate/:code', accountManager_controller_1.accountManagerController.validateCode);
// Partner (Account Manager) program endpoints.
// Admin-only: create a partner + tune the program config.
router.post('/admin', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), accountManager_controller_1.accountManagerController.createPartner);
router.put('/admin/config', auth_middleware_1.authenticate, (0, auth_middleware_1.authorize)('ADMIN'), accountManager_controller_1.accountManagerController.updateConfig);
// Authenticated partner dashboard.
router.post('/enroll', auth_middleware_1.authenticate, accountManager_controller_1.accountManagerController.enroll);
router.get('/me', auth_middleware_1.authenticate, accountManager_controller_1.accountManagerController.getMe);
router.get('/referrals', auth_middleware_1.authenticate, accountManager_controller_1.accountManagerController.getReferrals);
router.get('/ledger', auth_middleware_1.authenticate, accountManager_controller_1.accountManagerController.getLedger);
router.get('/payouts', auth_middleware_1.authenticate, accountManager_controller_1.accountManagerController.getPayouts);
// Cash out accrued (unbilled) referral commissions into a payout request.
router.post('/payout/request', auth_middleware_1.authenticate, accountManager_controller_1.accountManagerController.requestPayout);
exports.default = router;
//# sourceMappingURL=accountManager.routes.js.map