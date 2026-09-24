"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const airdrop_controller_1 = require("../controllers/airdrop.controller");
const router = (0, express_1.Router)();
// Public - anyone can check the stats
router.get('/stats', airdrop_controller_1.getAirdropStats);
// Protected - must be logged in
router.get('/eligibility', auth_middleware_1.authenticate, airdrop_controller_1.getEligibility);
router.post('/claim', auth_middleware_1.authenticate, airdrop_controller_1.claimAirdrop);
exports.default = router;
//# sourceMappingURL=airdrop.routes.js.map