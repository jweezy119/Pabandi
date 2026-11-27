import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { aiProviderRouter, aiProviderStatus, AiProviderName } from '../services/ai/aiProvider.router';
import { nvidiaVisionJson } from '../services/ai.payment.verifier.service';
import { aiNlpService } from '../services/ai.nlp.service';
import { runConcierge } from '../services/concierge.service';
import { jevStatus } from '../services/jev.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { checkSchema } from '../services/schema-check.service';
import { findInjectionPatterns, guardOutput, redactSecrets, sanitizeUntrusted } from '../security/aiGuard';
import { aiRateLimiter } from '../middleware/rateLimiter';

const router = Router();

const AI_PROVIDERS = new Set(['openai', 'google', 'dashscope', 'nvidia', 'pollinations']);

/** All user text reaches a model through a quarantined, capped, logged block. */
function aiInput(value: unknown, label: string): string {
  return sanitizeUntrusted(String(value ?? '').trim(), { label });
}

/**
 * Templates are instructions we ship, not external data: wrapping them in
 * UNTRUSTED boundaries would leak the markers into generated copy. Cap them,
 * redact credentials, and log injection attempts instead.
 */
function aiTemplate(value: unknown): string {
  const raw = String(value ?? '');
  const hits = findInjectionPatterns(raw);
  if (hits.length) logger.warn(`[AIGuard] injection markers in copy-template: ${hits.join(', ')}`);
  return redactSecrets(raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, 4000));
}

/** Structured model output is redacted before it reaches a client or a tool. */
function safeOutput<T>(value: T): T {
  return JSON.parse(guardOutput(JSON.stringify(value))) as T;
}

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

router.post('/nlp/classify', aiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const message = aiInput(req.body?.message, 'crm-message');
    if (!message) {
      return res.status(400).json({ success: false, error: 'message is required' });
    }
    const result = await aiNlpService.classifyIntentAndLanguage(message);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/nlp/generate', aiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const template = aiTemplate(req.body?.template);
    if (!template) {
      return res.status(400).json({ success: false, error: 'template is required' });
    }
    const context = req.body?.context && typeof req.body.context === 'object'
      ? JSON.parse(redactSecrets(JSON.stringify(req.body.context).slice(0, 12000)))
      : {};
    const text = await aiNlpService.generateCopy(template, context);
    return res.json({ success: true, data: { text: guardOutput(text) } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});
router.post('/test', aiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const requestedProvider = req.body?.provider ? String(req.body.provider) : undefined;
    if (requestedProvider && !AI_PROVIDERS.has(requestedProvider)) {
      return res.status(400).json({
        success: false,
        error: `Unknown provider. Allowed: ${[...AI_PROVIDERS].join(', ')}`,
      });
    }
    const result = await aiProviderRouter.generateJson<{ answer: string }>(
      'Reply with one short sentence: the Gemini integration is working.',
      {
        type: 'object',
        properties: { answer: { type: 'string' } },
        required: ['answer'],
      },
      { provider: requestedProvider as AiProviderName | undefined },
    );

    if (!result) {
      return res.status(502).json({
        success: false,
        error: 'No AI provider answered',
        providerErrors: aiProviderRouter.getLastError(),
      });
    }

    return res.json({ success: true, data: safeOutput(result) });
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
router.post('/concierge', aiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const query = aiInput(req.body?.query, 'concierge-query');
    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }
    // Wallet addresses are base58; keep the model prompt free of arbitrary text.
    const walletAddress = req.body?.walletAddress ? String(req.body.walletAddress).trim() : undefined;
    if (walletAddress && !/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(walletAddress)) {
      return res.status(400).json({ success: false, error: 'invalid walletAddress' });
    }

    const result = await runConcierge({
      query,
      walletAddress,
      city: req.body?.city ? aiInput(req.body.city, 'concierge-city') : undefined,
    });

    const data = safeOutput({
      message: result.message,
      intent: result.intent,
      language: result.language,
      proposal: result.proposal,
      alternatives: result.alternatives,
      provider: result.provider,
    });
    return res.json({
      success: true,
      data,
      // Convenience mirror so older clients reading `data.message` / `data.proposal`
      // keep working alongside the canonical `data.data` envelope.
      message: data.message,
      proposal: data.proposal,
    });
  } catch (error: any) {
    logger.error('[AI Concierge] request failed:', error?.message || error);
    return res.status(500).json({ success: false, error: 'Concierge unavailable right now' });
  }
});

router.post('/test-vision', aiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { imageBase64, prompt } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length > 7 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'imageBase64 required (max ~5MB)' });
    }
    const text = await nvidiaVisionJson(
      prompt ? aiInput(prompt, 'vision-prompt') : 'Describe what you see in this image as JSON.',
      imageBase64,
    );
    res.json({ success: true, data: { text: guardOutput(text) } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
