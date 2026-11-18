import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { aiProviderRouter } from '../services/ai/aiProvider.router';
import { aiNlpService } from '../services/ai.nlp.service';
import { jevStatus } from '../services/jev.service';
import { prisma } from '../utils/database';
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

router.get('/debug-db', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const clients = await prisma.crmClient.findMany({
      take: 5,
      select: { id: true, email: true, businessId: true, serviceBusinessId: true },
    });
    const fk = await prisma.$queryRaw<
      Array<{ constraint_name: string; column_name: string; foreign_table: string; foreign_column: string }>
    >`
      SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'Booking'
        AND kcu.column_name = 'clientId'
      LIMIT 5
    `;
    res.json({ success: true, data: { clients, bookingClientIdFk: fk } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/debug-google', authenticate, async (_req: AuthRequest, res: Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '';
    if (!apiKey) return res.status(400).json({ success: false, error: 'GEMINI_API_KEY not set' });
    const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'say hi' }] }] }),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await response.text();
    res.json({ success: response.ok, status: response.status, model, body: text.slice(0, 1000) });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/debug-schema', authenticate, async (_req: AuthRequest, res: Response) => {
  const result = await checkSchema();
  res.json({ success: true, data: result });
});

export default router;
