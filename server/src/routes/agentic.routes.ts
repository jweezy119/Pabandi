import { Router, Request, Response } from 'express';
import { agentOrchestrator, promoterAutonService, venueBrainService, guestFinderService, revenueMaxService } from '../services/agentic.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// AGENT CONTROL PANEL — Run agents manually or on schedule
// ═══════════════════════════════════════════════════════════════════════════

// Run all agents for a venue
router.post('/venues/:venueId/run', authenticate, async (req: any, res: Response) => {
  try {
    const result = await agentOrchestrator.runAllAgents({
      agentId: `orchestrator_${req.params.venueId}_${Date.now()}`,
      agentType: 'ORCHESTRATOR',
      venueId: req.params.venueId,
      metadata: req.body,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Agent execution failed' });
  }
});

// Run all agents for all venues
router.post('/run-all', authenticate, async (req: any, res: Response) => {
  try {
    const result = await agentOrchestrator.runAllVenues();
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Agent execution failed' });
  }
});

// Run specific agent type
router.post('/:agentType/run', authenticate, async (req: any, res: Response) => {
  try {
    const context = {
      agentId: `${req.params.agentType}_${Date.now()}`,
      agentType: req.params.agentType,
      userId: req.user?.id,
      venueId: req.body.venueId,
      promoterId: req.body.promoterId,
      metadata: req.body,
    };

    let result: any;
    switch (req.params.agentType) {
      case 'PROMOTER_AUTON':
        result = await promoterAutonService.runLoop(context);
        break;
      case 'VENUE_BRAIN':
        result = await venueBrainService.runLoop(context);
        break;
      case 'GUEST_FINDER':
        result = await guestFinderService.runLoop(context);
        break;
      case 'REVENUE_MAX':
        result = await revenueMaxService.runLoop(context);
        break;
      default:
        return res.status(400).json({ error: 'Unknown agent type' });
    }

    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Agent execution failed' });
  }
});

export default router;
