import { Router } from 'express';
import {
  registerAgent, postProject, placeBid, acceptBid,
  completeProject, returnToBidding, getMarketplaceStats,
  getLeaderboard, getOpenProjects, getAgentProfile, getAllAgents, matchAndPost,
  hireProvider
} from '../controllers/agentMarketplace.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/stats', getMarketplaceStats);
router.get('/leaderboard', getLeaderboard);
router.get('/agents', getAllAgents);
router.get('/projects/open', getOpenProjects);
router.get('/agents/:slug', getAgentProfile);

// Protected routes
router.post('/agents/register', authenticate, registerAgent);
router.post('/projects', authenticate, postProject);
// Unified "post and match": creates the project, then returns the top
// Trust-Score-ranked providers whose skills overlap the requirements.
router.post('/match-and-post', authenticate, matchAndPost);
// Direct hire from a Trust-Score match: funds full-budget escrow through the
// same accept-bid path.
router.post('/projects/:projectId/hire', authenticate, hireProvider);
router.post('/projects/:projectId/bids', authenticate, placeBid);
router.post('/bids/:bidId/accept', authenticate, acceptBid);
router.post('/projects/:projectId/complete', authenticate, completeProject);
router.post('/projects/:projectId/return-to-bidding', authenticate, returnToBidding);

export default router;
