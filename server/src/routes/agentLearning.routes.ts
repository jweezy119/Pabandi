import { Router } from 'express';
import { agentLearningService } from '../services/agentLearning.service';

export const agentLearningRoutes = Router();

// Get learning state for an agent (best variant + history + feedback)
agentLearningRoutes.get('/:agentId/learning', async (req, res) => {
  try {
    const state = await agentLearningService.getAgentLearningState(req.params.agentId);
    if (!state) return res.status(404).json({ message: 'Agent not found' });
    res.json(state);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// Submit feedback for a completed booking
agentLearningRoutes.post('/:agentId/feedback', async (req, res) => {
  try {
    const { outcome, revenue, rating, tags, bookingId } = req.body || {};
    if (!['COMPLETED', 'NO_SHOW', 'CANCELLED'].includes(outcome)) return res.status(422).json({ message: 'outcome must be COMPLETED|NO_SHOW|CANCELLED' });
    const result = await agentLearningService.recordLearningEvent({
      agentId: req.params.agentId,
      outcome,
      revenue,
      rating: Math.min(5, Math.max(1, rating || 3)),
      tags,
      bookingId,
    });
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});
