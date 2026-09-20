import { Router } from 'express';
import { jevDecision } from '../services/jevDecision.service';

const router = Router();

// Agent trading decisions
router.post('/trading-decision/:agentId', async (req, res) => {
  try {
    const result = await jevDecision.getTradingDecision(req.params.agentId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Tenant risk assessment
router.post('/tenant-risk/:tenantId', async (req, res) => {
  try {
    const result = await jevDecision.getTenantRiskAssessment(req.params.tenantId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Payment routing
router.post('/payment-route/:userId', async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await jevDecision.getPaymentRoute(req.params.userId, amount);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Agent quality score
router.post('/agent-quality/:agentId', async (req, res) => {
  try {
    const result = await jevDecision.getAgentQualityScore(req.params.agentId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Generic decision
router.post('/decide', async (req, res) => {
  try {
    const { state, questions } = req.body;
    const result = await jevDecision.decide(state, questions);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
