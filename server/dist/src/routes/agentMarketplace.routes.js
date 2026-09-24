"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agentMarketplace_controller_1 = require("../controllers/agentMarketplace.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = (0, express_1.Router)();
// Public routes
router.get('/stats', agentMarketplace_controller_1.getMarketplaceStats);
router.get('/leaderboard', agentMarketplace_controller_1.getLeaderboard);
router.get('/projects/open', agentMarketplace_controller_1.getOpenProjects);
router.get('/agents/:slug', agentMarketplace_controller_1.getAgentProfile);
// Protected routes
router.post('/agents/register', auth_middleware_1.authenticate, agentMarketplace_controller_1.registerAgent);
router.post('/projects', auth_middleware_1.authenticate, agentMarketplace_controller_1.postProject);
router.post('/projects/:projectId/bids', auth_middleware_1.authenticate, agentMarketplace_controller_1.placeBid);
router.post('/bids/:bidId/accept', auth_middleware_1.authenticate, agentMarketplace_controller_1.acceptBid);
router.post('/projects/:projectId/complete', auth_middleware_1.authenticate, agentMarketplace_controller_1.completeProject);
router.post('/projects/:projectId/return-to-bidding', auth_middleware_1.authenticate, agentMarketplace_controller_1.returnToBidding);
exports.default = router;
//# sourceMappingURL=agentMarketplace.routes.js.map