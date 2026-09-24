"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reward_controller_1 = require("../controllers/reward.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
router.get('/balance', auth_middleware_1.authenticate, reward_controller_1.getRewardBalance);
router.get('/history', auth_middleware_1.authenticate, reward_controller_1.getRewardHistory);
router.get('/tiers', reward_controller_1.getRewardTiers);
router.post('/calculate', reward_controller_1.calculateRewards);
router.post('/fee-offset', auth_middleware_1.authenticate, reward_controller_1.getFeeOffset);
exports.default = router;
//# sourceMappingURL=reward.routes.js.map