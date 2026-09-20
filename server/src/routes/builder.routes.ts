import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { builderService } from '../services/builder.service';

const router = Router();

// POST /api/v1/builder/register
router.post('/register', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { companyName, licenseNumber } = req.body;
    if (!companyName) return res.status(400).json({ error: 'companyName is required' });
    const profile = await builderService.createProfile(userId, { companyName, licenseNumber });
    res.status(201).json({ success: true, data: profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/builder/profile
router.get('/profile', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const profile = await builderService.getProfile(userId);
    res.json({ success: true, data: profile });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/builder/projects
router.get('/projects', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const profile = await builderService.getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Builder profile not found' });
    const projects = await builderService.getProjects(profile.id);
    res.json({ success: true, data: projects });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/builder/projects
router.post('/projects', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const profile = await builderService.getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Builder profile not found' });
    const { name, location, description, totalUnits, startDate, expectedCompletion } = req.body;
    if (!name || !location || !totalUnits || !startDate || !expectedCompletion) {
      return res.status(400).json({ error: 'name, location, totalUnits, startDate, expectedCompletion are required' });
    }
    const project = await builderService.createProject(profile.id, {
      name, location, description, totalUnits: parseInt(totalUnits),
      startDate: new Date(startDate), expectedCompletion: new Date(expectedCompletion),
    });
    res.status(201).json({ success: true, data: project });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/builder/projects/:id
router.get('/projects/:id', authenticate, async (req: any, res: Response) => {
  try {
    const project = await builderService.getProjectDetail(req.params.id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    res.json({ success: true, data: project });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/builder/units
router.post('/units', authenticate, async (req: any, res: Response) => {
  try {
    const { projectId, unitNumber, type, size, price, floor } = req.body;
    if (!projectId || !unitNumber || !type || !size || !price) {
      return res.status(400).json({ error: 'projectId, unitNumber, type, size, price are required' });
    }
    const unit = await builderService.addUnit(projectId, {
      unitNumber, type, size: parseInt(size), price: parseFloat(price), floor: floor ? parseInt(floor) : undefined,
    });
    res.status(201).json({ success: true, data: unit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/builder/units/:id/book
router.post('/units/:id/book', authenticate, async (req: any, res: Response) => {
  try {
    const buyerId = req.body.buyerId || req.user?.id;
    const unit = await builderService.bookUnit(req.params.id, buyerId);
    res.json({ success: true, data: unit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/builder/units/:id/sell
router.post('/units/:id/sell', authenticate, async (req: any, res: Response) => {
  try {
    const buyerId = req.body.buyerId || req.user?.id;
    const unit = await builderService.sellUnit(req.params.id, buyerId);
    res.json({ success: true, data: unit });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/builder/buyers
router.get('/buyers', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const profile = await builderService.getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Builder profile not found' });
    const buyers = await builderService.getBuyers(profile.id);
    res.json({ success: true, data: buyers });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/builder/installments
router.get('/installments', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const profile = await builderService.getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Builder profile not found' });
    const status = req.query.status as string | undefined;
    const installments = await builderService.getInstallments(profile.id, status);
    res.json({ success: true, data: installments });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/builder/milestones
router.post('/milestones', authenticate, async (req: any, res: Response) => {
  try {
    const { projectId, title, description, dueDate } = req.body;
    if (!projectId || !title || !dueDate) {
      return res.status(400).json({ error: 'projectId, title, dueDate are required' });
    }
    const milestone = await builderService.addMilestone(projectId, {
      title, description, dueDate: new Date(dueDate),
    });
    res.status(201).json({ success: true, data: milestone });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/v1/builder/milestones/:id/complete
router.put('/milestones/:id/complete', authenticate, async (req: any, res: Response) => {
  try {
    const milestone = await builderService.completeMilestone(req.params.id);
    res.json({ success: true, data: milestone });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/builder/reminders/:id
router.post('/reminders/:id', authenticate, async (req: any, res: Response) => {
  try {
    const result = await builderService.sendReminder(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/builder/trust-score
router.get('/trust-score', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const profile = await builderService.getProfile(userId);
    if (!profile) return res.status(404).json({ error: 'Builder profile not found' });
    const score = await builderService.getTrustScore(profile.id);
    res.json({ success: true, data: score });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/builder/search
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { location, priceMin, priceMax, type } = req.query;
    const projects = await builderService.searchProjects({
      location: location as string | undefined,
      priceMin: priceMin ? parseFloat(priceMin as string) : undefined,
      priceMax: priceMax ? parseFloat(priceMax as string) : undefined,
      type: type as string | undefined,
    });
    res.json({ success: true, data: projects });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
