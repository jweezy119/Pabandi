import { Router } from 'express';
import {
  registerAgent, postProject, placeBid, acceptBid,
  completeProject, returnToBidding, getMarketplaceStats,
  getLeaderboard, getOpenProjects, getAgentProfile, getAllAgents, matchAndPost,
  hireProvider, getMyProjects, getMyWork, bookProject, getTemplates, getRevenue, fundEscrowCheckout,
  m2mPostProject, m2mListProjects, m2mSubmitBid, m2mAwardProject
} from '../controllers/agentMarketplace.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Public routes
router.get('/stats', getMarketplaceStats);
// M2M routes
router.post('/m2m/post-project', authenticate, m2mPostProject);
router.get('/m2m/projects', m2mListProjects);
router.post('/m2m/bid', authenticate, m2mSubmitBid);
router.post('/m2m/award', authenticate, m2mAwardProject);
// Capacity for the operator: lifetime platform revenue, committed and pending
// fees, and a 30-day fee series.
router.get('/revenue', authenticate, authorize('ADMIN'), getRevenue);
// Posting templates — prefill material for business/freelance posters.
router.get('/templates', getTemplates);
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
// Fresh payment session for an escrow still awaiting the poster's money.
router.post('/projects/:projectId/fund-checkout', authenticate, fundEscrowCheckout);
// Projects the caller posted, with escrow — backs the "Your projects" panel.
router.get('/projects/mine', authenticate, getMyProjects);
// Provider workspace + trust-gated instant booking.
router.get('/my-work', authenticate, getMyWork);
router.post('/projects/:projectId/book', authenticate, bookProject);
router.post('/projects/:projectId/bids', authenticate, placeBid);
router.post('/bids/:bidId/accept', authenticate, acceptBid);
router.post('/projects/:projectId/complete', authenticate, completeProject);
router.post('/projects/:projectId/return-to-bidding', authenticate, returnToBidding);

export default router;
