import { Router, Request, Response, NextFunction } from 'express';
import { aiNlpService } from '../services/ai.nlp.service';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'ai',
    endpoints: ['/api/v1/ai/status', '/api/v1/ai/models', '/api/v1/ai/nlp/classify', '/api/v1/ai/nlp/generate'],
    models: aiNlpService.getEnabledModels(),
  });
});

// POST /api/v1/ai/nlp/classify
router.post('/nlp/classify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ success: false, error: 'message is required' });
      return;
    }
    const classification = await aiNlpService.classifyIntentAndLanguage(message);
    res.json({ success: true, data: classification });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/ai/nlp/generate
router.post('/nlp/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { template, context } = req.body;
    if (!template || !context) {
      res.status(400).json({ success: false, error: 'template and context are required' });
      return;
    }
    const copy = await aiNlpService.generateCopy(template, context);
    res.json({ success: true, data: { copy } });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/ai/models
router.get('/models', (req: Request, res: Response) => {
  const models = aiNlpService.getEnabledModels();
  res.json({ success: true, data: models });
});

export default router;
