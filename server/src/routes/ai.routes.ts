import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { aiProviderRouter } from '../services/ai/aiProvider.router';
import { jevStatus } from '../services/jev.service';

const router = Router();

/**
 * Provider status. Public on purpose: an operator checking whether AI is live
 * should not need a session. It returns booleans, never keys.
 */
router.get('/status', (_req, res: Response) => {
  res.json({
    success: true,
    data: {
      providers: aiProviderRouter.getStatus(),
      jev: jevStatus(),
    },
  });
});

/**
 * One real call through the provider chain. Authenticated because it spends
 * money and is the only way to prove the configured key actually answers.
 */
router.post('/test', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await aiProviderRouter.generateJson<{ answer: string }>(
      'Reply with one short sentence: the Gemini integration is working.',
      {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
      },
    );

    if (!result) {
      return res.status(502).json({ success: false, error: 'No AI provider answered' });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
