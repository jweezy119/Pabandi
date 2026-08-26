import { Router, Request, Response, NextFunction } from 'express';
import { programService } from '../services/program.service';

const router = Router();

/** POST /api/v1/programs — decompose + budget a long, multi-task engagement into staffed tasks. */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body || {};
    const r = await programService.createProgram({
      title: b.title, description: b.description, durationWeeks: b.durationWeeks,
      skillMix: b.skillMix, intensity: b.intensity, clientWallet: b.clientWallet, referralCode: b.referralCode || 'PABANDI',
    });
    res.json({ success: true, data: r });
  } catch (e: any) { next(e); }
});

/** POST /api/v1/programs/:id/staff — staff the next pending task (create its gig on the open board). */
router.post('/:id/staff', async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await programService.staffNextTask(req.params.id); res.json({ success: true, data: r }); }
  catch (e: any) { next(e); }
});

/** GET /api/v1/programs/:id — program status + per-task progress. */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { const r = await programService.programStatus(req.params.id); res.json({ success: true, data: r }); }
  catch (e: any) { next(e); }
});

export default router;
