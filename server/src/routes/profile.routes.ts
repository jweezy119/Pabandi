import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { profileService, ProfileUpdate } from '../services/profile.service';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { logger } from '../utils/logger';

const router = Router();

// GET /api/v1/profile/me — get own profile
router.get('/me', authenticate, apiLimiter, async (req: any, res: Response) => {
  try {
    const passport = await profileService.getOrCreate(req.user.id);
    return res.json({ success: true, data: passport });
  } catch (error: any) {
    logger.error(`[Profile] get error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/v1/profile/me — update own profile
router.patch('/me', authenticate, writeLimiter, async (req: any, res: Response) => {
  try {
    const data = req.body as ProfileUpdate;
    const passport = await profileService.update(req.user.id, data);
    return res.json({ success: true, data: passport });
  } catch (error: any) {
    logger.error(`[Profile] update error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/v1/profile/:handle — public profile
router.get('/:handle', apiLimiter, async (req: Request, res: Response) => {
  try {
    const passport = await profileService.getPublic(req.params.handle);
    if (!passport) {
      return res.status(404).json({ success: false, error: 'Profile not found or private' });
    }
    return res.json({ success: true, data: passport });
  } catch (error: any) {
    logger.error(`[Profile] public error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;