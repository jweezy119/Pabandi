import { Router, Request, Response } from 'express';
import { backgroundCheckService } from '../services/backgroundCheck.service';
import { authenticate } from '../middleware/auth.middleware';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// BACKGROUND CHECK ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Run full background check
router.post('/run', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, dob, ssn, state, county } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and lastName required' });
    }

    const result = await backgroundCheckService.runFullBackgroundCheck({
      firstName,
      lastName,
      dob,
      ssn,
      state,
      county,
      userId,
    });

    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Background check failed' });
  }
});

// Quick search (no DB save)
router.get('/search', authenticate, async (req: any, res: Response) => {
  try {
    const { firstName, lastName, state } = req.query;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and lastName required' });
    }

    const result = await backgroundCheckService.quickSearch(
      firstName as string,
      lastName as string,
      state as string
    );

    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Search failed' });
  }
});

// Get check by ID
router.get('/:checkId', authenticate, async (req: any, res: Response) => {
  try {
    const check = await prisma.backgroundCheck.findFirst({
      where: { id: req.params.checkId },
    });

    if (!check) return res.status(404).json({ error: 'Check not found' });
    res.json({ success: true, data: check });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load check' });
  }
});

// Get user's background checks
router.get('/user/me', authenticate, async (req: any, res: Response) => {
  try {
    const checks = await prisma.backgroundCheck.findMany({
      where: { requestedBy: req.user?.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: checks });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load checks' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MONITORING
// ═══════════════════════════════════════════════════════════════════════════

// Setup monitoring for a person
router.post('/monitor', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, state } = req.body;
    
    const monitoring = await backgroundCheckService.setupMonitoring(userId, {
      firstName,
      lastName,
      state,
    });

    res.status(201).json({ success: true, data: monitoring });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to setup monitoring' });
  }
});

// Get user's monitoring list
router.get('/monitor/me', authenticate, async (req: any, res: Response) => {
  try {
    const monitoring = await prisma.backgroundCheck.findMany({
      where: { requestedBy: req.user?.id, trigger: 'RECURRING' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: monitoring });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load monitoring' });
  }
});

// Run monitoring check manually
router.post('/monitor/:id/check', authenticate, async (req: any, res: Response) => {
  try {
    const result = await backgroundCheckService.runMonitoringCheck(req.params.id);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Monitoring check failed' });
  }
});

export default router;
