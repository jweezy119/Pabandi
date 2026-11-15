import { Router, Request, Response } from 'express';
import { vcJwks } from '../trust/vcKeys';

const router = Router();

router.get('/pabandi-keys.json', (_req: Request, res: Response) => {
  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(vcJwks());
  } catch {
    res.status(503).json({
      error: 'VC_SIGNING_PRIVATE_KEY is not configured',
    });
  }
});

export default router;
