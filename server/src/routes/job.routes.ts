import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/auth.middleware';
import * as jobService from '../services/job.service';

const router = Router();
router.use(authenticate);

function getBusinessId(req: AuthRequest): string {
  const businessId = req.body?.businessId || req.query?.businessId;
  if (!businessId) throw new Error('businessId is required');
  return businessId as string;
}

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.createJob(getBusinessId(req), req.body);
    res.status(201).json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const jobs = await jobService.getJobs(getBusinessId(req), req.query);
    res.json({ success: true, data: jobs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.getJob(getBusinessId(req), req.params.id);
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.updateJob(getBusinessId(req), req.params.id, req.body);
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/checkin', async (req: AuthRequest, res: Response) => {
  try {
    const job = await jobService.checkInJob(req.params.id, req.user.id);
    res.json({ success: true, data: job });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:id/checkout', async (req: AuthRequest, res: Response) => {
  try {
    const result = await jobService.checkOutJob(req.params.id, req.user.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
