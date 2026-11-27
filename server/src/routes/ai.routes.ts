import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { aiProviderRouter, aiProviderStatus } from '../services/ai/aiProvider.router';
import { nvidiaVisionJson } from '../services/ai.payment.verifier.service';
import { aiNlpService } from '../services/ai.nlp.service';
import { runConcierge } from '../services/concierge.service';
import { jevStatus } from '../services/jev.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { checkSchema } from '../services/schema-check.service';

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

router.get('/models', (_req, res: Response) => {
  res.json({
    success: true,
    data: {
      providers: aiProviderRouter.getStatus(),
      models: aiNlpService.getEnabledModels(),
      jev: jevStatus(),
    },
  });
});

router.post('/nlp/classify', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const message = String(req.body?.message ?? '').trim();
    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    const result = await aiNlpService.classifyIntentAndLanguage(message);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/nlp/generate', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const template = String(req.body?.template ?? '').trim();
    if (!template) {
      return res.status(400).json({ success: false, error: 'template is required' });
    }
    const context = req.body?.context && typeof req.body.context === 'object' ? req.body.context : {};
    const text = await aiNlpService.generateCopy(template, context);
    return res.json({ success: true, data: { text } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
router.post('/test', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await aiProviderRouter.generateJson<{ answer: string }>(
      'Reply with one short sentence: the Gemini integration is working.',
      {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
      },
      { provider: req.body?.provider },
    );

    if (!result) {
      return res.status(502).json({
        success: false,
        error: 'No AI provider answered',
        providerErrors: aiProviderRouter.getLastError(),
      });
    }

    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * AI Concierge — natural-language discovery + booking proposal.
 *
 * Powers the global concierge widget. Authenticated (the widget only mounts for
 * signed-in users), and reads the wallet address from the body to tailor escrow
 * framing. Returns a proposal the client deep-links into the booking flow; it
 * never creates a booking or moves money here.
 */
router.post('/concierge', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const query = String(req.body?.query ?? '').trim();
    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const result = await runConcierge({
      query,
      walletAddress: req.body?.walletAddress ? String(req.body.walletAddress) : undefined,
      city: req.body?.city ? String(req.body.city) : undefined,
    });

    return res.json({
      success: true,
      data: {
        message: result.message,
        intent: result.intent,
        language: result.language,
        proposal: result.proposal,
        alternatives: result.alternatives,
        provider: result.provider,
      },
      // Convenience mirror so older clients reading `data.message` / `data.proposal`
      // keep working alongside the canonical `data.data` envelope.
      message: result.message,
      proposal: result.proposal,
    });
  } catch (error: any) {
    logger.error('[AI Concierge] request failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Concierge unavailable right now' });
  }
});

router.post('/test-vision', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { imageBase64, prompt } = req.body || {};
    if (!imageBase64) return res.status(400).json({ success: false, error: 'imageBase64 required' });
    const text = await nvidiaVisionJson(
      prompt || 'Describe what you see in this image as JSON.',
      imageBase64,
    );
    res.json({ success: true, data: { text } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
