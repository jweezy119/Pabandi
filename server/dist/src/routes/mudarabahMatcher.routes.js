"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const mudarabahMatcher_controller_1 = require("../controllers/mudarabahMatcher.controller");
const router = (0, express_1.Router)();
// ── All routes require authentication ─────────────────────────────────
router.get('/recommendations', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.getRecommendations);
router.get('/investors/:poolId', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.getRecommendedInvestors);
router.post('/profile', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.upsertProfile);
router.get('/profile', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.getProfile);
router.get('/insights', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.getInsights);
router.post('/feedback', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.recordFeedback);
router.get('/stats', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.getStats);
// ── Batch match generation (called by cron or admin) ──────────────────
router.post('/batch-generate', auth_middleware_1.authenticate, mudarabahMatcher_controller_1.batchGenerateMatches);
exports.default = router;
//# sourceMappingURL=mudarabahMatcher.routes.js.map