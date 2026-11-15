import { Router, Request, Response } from 'express';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth.middleware';
import { authenticateAgent } from '../middleware/agentAuth.middleware';
import { optionalAgentAuth } from '../middleware/agentAuth.middleware';
import { requireScopes } from '../services/agentScopes.service';
import { TOOLS } from '../mcp/pabandiMcpServer';
import { agentTools } from '../services/agentTools.service';
import { createAgentKey, listAgentKeys, revokeAgentKey } from '../services/agentKeys.service';
import { getPaidProofByPublicId, listPaidProofsForWorker } from '../services/paidProof.service';

const router = Router();

router.get('/tools', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      protocol: 'mcp',
      mcpEndpoint: '/mcp',
      tools: TOOLS,
    },
  });
});

router.post('/keys', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const key = await createAgentKey(req.user!.id, req.body || {});
    res.status(201).json({ success: true, data: key });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/keys', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await listAgentKeys(req.user!.id) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/keys/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const key = await revokeAgentKey(req.user!.id, req.params.id);
    res.json({ success: true, data: { id: key.id, revokedAt: key.revokedAt } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/businesses', optionalAgentAuth, requireScopes('directory'), async (req: Request, res: Response) => {
  try {
    const result = await agentTools.listBusinesses({
      cursor: req.query.cursor as string,
      limit: Number(req.query.limit) || undefined,
      city: req.query.city as string,
      category: req.query.category as string,
      query: (req.query.query || req.query.search) as string,
      search: req.query.search as string,
      location: req.query.location as string,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/businesses/:id', optionalAgentAuth, requireScopes('directory'), async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await agentTools.getBusinessById(req.params.id) });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/bookings', authenticateAgent, requireScopes('booking'), async (req: AuthRequest, res: Response) => {
  try {
    const booking = await agentTools.createBookingForAgent(req.user!, req.body || {});
    res.status(201).json({ success: true, data: booking });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/bookings/:id', optionalAuthenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await agentTools.getBookingForAgent(req.params.id) });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/bookings/:id/checkin', authenticateAgent, requireScopes('booking'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await agentTools.markBookingCheckin(req.user!, req.params.id, req.body || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/bookings/:id/release', authenticateAgent, requireScopes('booking'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await agentTools.releaseBookingEscrow(req.user!, req.params.id, req.body || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/bookings/:id/refund', authenticateAgent, requireScopes('booking'), async (req: AuthRequest, res: Response) => {
  try {
    const result = await agentTools.refundBookingForAgent(req.user!, req.params.id, String(req.body?.reason || ''));
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/passport/verify', async (req: Request, res: Response) => {
  try {
    const result = await agentTools.verifyPassportProof(req.body || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/payouts', authenticateAgent, requireScopes('payout'), async (req: AuthRequest, res: Response) => {
  try {
    const payout = await agentTools.requestPayoutForAgent(req.user!, req.body || {});
    res.status(201).json({ success: true, data: payout });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/payouts/history', authenticateAgent, requireScopes('payout'), async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await agentTools.getPayoutHistoryForAgent(req.user!) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/identity', authenticateAgent, requireScopes('identity'), (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      id: req.user!.id,
      email: req.user!.email,
      role: req.user!.role,
      businessId: req.user!.businessId ?? null,
      firstName: req.user!.firstName ?? null,
      lastName: req.user!.lastName ?? null,
      phone: req.user!.phone ?? null,
    },
  });
});

router.get('/paid/:publicId', async (req: Request, res: Response) => {
  try {
    const proof = await getPaidProofByPublicId(req.params.publicId);
    if (!proof) return res.status(404).json({ success: false, error: 'Proof not found' });
    res.json({ success: true, data: proof });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/workers/me/paid', authenticateAgent, requireScopes('proof'), async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await listPaidProofsForWorker(req.user!.id) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
