import { Router, Request, Response } from 'express';
import { authenticate, optionalAuthenticate, AuthRequest } from '../middleware/auth.middleware';
import { TOOLS } from '../mcp/pabandiMcpServer';
import { agentTools } from '../services/agentTools.service';

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

router.get('/businesses', async (req: Request, res: Response) => {
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

router.get('/businesses/:id', async (req: Request, res: Response) => {
  try {
    res.json({ success: true, data: await agentTools.getBusinessById(req.params.id) });
  } catch (error: any) {
    res.status(404).json({ success: false, error: error.message });
  }
});

router.post('/bookings', authenticate, async (req: AuthRequest, res: Response) => {
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

router.post('/bookings/:id/checkin', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await agentTools.markBookingCheckin(req.user!, req.params.id, req.body || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/bookings/:id/release', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await agentTools.releaseBookingEscrow(req.user!, req.params.id, req.body || {});
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/bookings/:id/refund', authenticate, async (req: AuthRequest, res: Response) => {
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

router.post('/payouts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const payout = await agentTools.requestPayoutForAgent(req.user!, req.body || {});
    res.status(201).json({ success: true, data: payout });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/payouts/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: await agentTools.getPayoutHistoryForAgent(req.user!) });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/identity', authenticate, (req: AuthRequest, res: Response) => {
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

export default router;
