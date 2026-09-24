"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pabandiReview_controller_1 = require("../controllers/pabandiReview.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const router = express_1.default.Router();
// Create a verified review (must have completed reservation + check-in)
router.post('/', auth_middleware_1.authenticate, (req, res, next) => {
    (0, pabandiReview_controller_1.createReview)(req, res, next);
});
// Upvote a review (must have verified check-in at same business)
router.post('/:id/upvote', auth_middleware_1.authenticate, (req, res, next) => {
    (0, pabandiReview_controller_1.upvoteReview)(req, res, next);
});
// Owner reply to a verified review (must own the business)
router.post('/:id/reply', auth_middleware_1.authenticate, (req, res, next) => {
    (0, pabandiReview_controller_1.replyToReview)(req, res, next);
});
// Get upvotes on a review (public)
router.get('/:id/upvotes', (req, res, next) => {
    (0, pabandiReview_controller_1.getReviewUpvotes)(req, res, next);
});
// Get Star Power profile for a user (public)
router.get('/star-power/:userId', (req, res, next) => {
    (0, pabandiReview_controller_1.getStarPower)(req, res, next);
});
// Get Star Power leaderboard for a business's reviewers (public)
router.get('/star-power/business/:businessId', (req, res, next) => {
    (0, pabandiReview_controller_1.getBusinessStarLeaderboard)(req, res, next);
});
exports.default = router;
//# sourceMappingURL=pabandiReview.routes.js.map