import express from 'express';
import {
  createReview,
  upvoteReview,
  replyToReview,
  getReviewUpvotes,
  getStarPower,
  getBusinessStarLeaderboard,
} from '../controllers/pabandiReview.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

// Create a verified review (must have completed reservation + check-in)
router.post('/', authenticate, (req: any, res: any, next: any) => {
  createReview(req, res, next);
});

// Upvote a review (must have verified check-in at same business)
router.post('/:id/upvote', authenticate, (req: any, res: any, next: any) => {
  upvoteReview(req, res, next);
});

// Owner reply to a verified review (must own the business)
router.post('/:id/reply', authenticate, (req: any, res: any, next: any) => {
  replyToReview(req, res, next);
});

// Get upvotes on a review (public)
router.get('/:id/upvotes', (req: any, res: any, next: any) => {
  getReviewUpvotes(req, res, next);
});

// Get Star Power profile for a user (public)
router.get('/star-power/:userId', (req: any, res: any, next: any) => {
  getStarPower(req, res, next);
});

// Get Star Power leaderboard for a business's reviewers (public)
router.get('/star-power/business/:businessId', (req: any, res: any, next: any) => {
  getBusinessStarLeaderboard(req, res, next);
});

export default router;
