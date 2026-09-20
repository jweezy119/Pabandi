import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { safLoad, safCarrier, safMatching, safRate } from '../services/safOS.service';

const router = Router();

// Loads
router.get('/loads', authenticate, async (req: any, res: Response) => {
  try {
    const { status, originCity, destCity, cargoType } = req.query;
    const loads = await safLoad.getLoads({ status: status as string, originCity: originCity as string, destCity: destCity as string, cargoType: cargoType as string });
    res.json({ success: true, data: loads });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get loads' }); }
});

router.get('/loads/:id', authenticate, async (req: any, res: Response) => {
  try {
    const load = await safLoad.getLoadDetail(req.params.id);
    if (!load) return res.status(404).json({ error: 'Load not found' });
    res.json({ success: true, data: load });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get load details' }); }
});

router.post('/loads', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const load = await safLoad.postLoad({ ...req.body, shipperId: userId });
    res.status(201).json({ success: true, data: load });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to post load' }); }
});

router.put('/loads/:id/status', authenticate, async (req: any, res: Response) => {
  try {
    const { status } = req.body;
    const load = await safLoad.updateLoadStatus(req.params.id, status);
    res.json({ success: true, data: load });
  } catch (e: any) { res.status(500).json({ error: 'Failed to update load status' }); }
});

router.delete('/loads/:id', authenticate, async (req: any, res: Response) => {
  try {
    await safLoad.deleteLoad(req.params.id);
    res.json({ success: true, message: 'Load deleted' });
  } catch (e: any) { res.status(500).json({ error: 'Failed to delete load' }); }
});

// Carriers
router.get('/carriers', authenticate, async (req: any, res: Response) => {
  try {
    const { verified, state } = req.query;
    const carriers = await safCarrier.getCarriers({ verified: verified === 'true' ? true : verified === 'false' ? false : undefined, state: state as string });
    res.json({ success: true, data: carriers });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get carriers' }); }
});

router.get('/carriers/:id', authenticate, async (req: any, res: Response) => {
  try {
    const carrier = await safCarrier.getCarrierDetail(req.params.id);
    if (!carrier) return res.status(404).json({ error: 'Carrier not found' });
    res.json({ success: true, data: carrier });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get carrier details' }); }
});

router.post('/carriers', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const carrier = await safCarrier.registerCarrier({ ...req.body, userId });
    res.status(201).json({ success: true, data: carrier });
  } catch (e: any) { res.status(500).json({ error: e.message || 'Failed to register carrier' }); }
});

router.post('/carriers/:id/rate', authenticate, async (req: any, res: Response) => {
  try {
    const { rating, review } = req.body;
    const carrier = await safCarrier.rateCarrier(req.params.id, rating, review);
    res.json({ success: true, data: carrier });
  } catch (e: any) { res.status(500).json({ error: 'Failed to rate carrier' }); }
});

// Matching
router.post('/match', authenticate, async (req: any, res: Response) => {
  try {
    const { loadId } = req.body;
    const matches = await safMatching.matchLoadToCarrier(loadId);
    res.json({ success: true, data: matches });
  } catch (e: any) { res.status(500).json({ error: 'Failed to match load' }); }
});

router.post('/accept', authenticate, async (req: any, res: Response) => {
  try {
    const { carrierId, loadId, amountUsd } = req.body;
    const bid = await safMatching.acceptLoad(carrierId, loadId, amountUsd);
    res.json({ success: true, data: bid });
  } catch (e: any) { res.status(500).json({ error: 'Failed to accept load' }); }
});

router.get('/matching-history', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const history = await safMatching.getMatchingHistory(userId);
    res.json({ success: true, data: history });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get matching history' }); }
});

// Rates
router.get('/rates', authenticate, async (req: any, res: Response) => {
  try {
    const distance = Number(req.query.distance) || 0;
    const weight = Number(req.query.weight) || 0;
    const type = (req.query.type as string) || 'GENERAL';
    const rate = await safRate.calculateRate(distance, weight, type);
    res.json({ success: true, data: rate });
  } catch (e: any) { res.status(500).json({ error: 'Failed to calculate rate' }); }
});

router.get('/rates/history', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const history = await safRate.getRateHistory(userId);
    res.json({ success: true, data: history });
  } catch (e: any) { res.status(500).json({ error: 'Failed to get rate history' }); }
});

export default router;
