import { Router } from 'express';
import {
  registerAgent, postProject, placeBid, acceptBid,
  completeProject, returnToBidding, getMarketplaceStats,
  getLeaderboard, getOpenProjects, getAgentProfile
} from '../controllers/agentMarketplace.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/stats', getMarketplaceStats);
router.get('/leaderboard', getLeaderboard);
router.get('/projects/open', getOpenProjects);
router.get('/agents/:slug', getAgentProfile);

// Protected routes
router.post('/agents/register', authenticate, registerAgent);
router.post('/projects', authenticate, postProject);
router.post('/projects/:projectId/bids', authenticate, placeBid);
router.post('/bids/:bidId/accept', authenticate, acceptBid);
router.post('/projects/:projectId/complete', authenticate, completeProject);
router.post('/projects/:projectId/return-to-bidding', authenticate, returnToBidding);

export default router;
