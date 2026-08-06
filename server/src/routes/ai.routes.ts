import { Router, Request, Response, NextFunction } from 'express';
import { aiNlpService } from '../services/ai.nlp.service';
import { noShowPredictor } from '../services/ai/noShowPredictor';
import { prisma } from '../utils/database';
import { osintMCPClient } from '../services/osint/osintMCPClient.service';

const router = Router();

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'ai',
    endpoints: ['/api/v1/ai/status', '/api/v1/ai/models', '/api/v1/ai/nlp/classify', '/api/v1/ai/nlp/generate', '/api/v1/ai/forecast/demand'],
    models: aiNlpService.getEnabledModels(),
  });
});

router.post('/forecast/demand', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, date, category, groupSize, advanceBookingDays } = req.body || {};
    if (!businessId || !date) {
      res.status(400).json({ success: false, error: 'businessId and date are required' });
      return;
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, category: true, rating: true },
    });
    if (!business) {
      res.status(404).json({ success: false, error: 'Business not found' });
      return;
    }

    const target = new Date(date);
    const isWeekend = target.getDay() === 5 || target.getDay() === 6;
    const today = new Date();
    const end = new Date(target.getTime() + 86_400_000);
    const advanceDays = Math.max(0, Math.floor((today.getTime() - target.getTime()) / -86_400_000));

    const reservationCount = await prisma.reservation.count({
      where: { businessId, reservationDate: { gte: target, lt: end } },
    });

    const historical = await prisma.reservation.findMany({
      where: { businessId, createdAt: { gte: new Date(today.getTime() - 30 * 86_400_000) } },
      select: { status: true },
    });
    const noShowCount = historical.filter(r => r.status === 'NO_SHOW').length;
    const cancelledCount = historical.filter(r => r.status === 'CANCELLED').length;
    const historyCount = historical.length || 1;
    const averageNoShowRate = noShowCount / historyCount;

    const prediction = await noShowPredictor.predict({
      customerHistory: { totalReservations: historyCount, noShowCount, cancellationCount: cancelledCount, averageNoShowRate },
      timeFactors: { dayOfWeek: target.getDay(), hour: 19, isWeekend, isHoliday: false },
      bookingFactors: { advanceBookingDays: advanceBookingDays ?? advanceDays, isSameDay: advanceDays <= 0, groupSize: groupSize || 2, hasSpecialRequests: false },
      businessFactors: { averageNoShowRate, businessRating: business.rating ?? undefined, requiresDeposit: false, businessCategory: category || business.category?.toUpperCase() || 'OTHER' },
    });

    const forecast = {
      businessId,
      businessName: business.name,
      date: target.toISOString().split('T')[0],
      weekday: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][target.getDay()],
      confidence: Math.max(0, Math.min(1, 1 - prediction.probability)),
      demandSignal: prediction.riskScore > 65 ? 'high' : prediction.riskScore > 40 ? 'medium' : 'low',
      recommendation: prediction.depositRecommendation.required ? 'Require deposit or release overbook margin carefully.' : 'Standard booking flow acceptable.',
      predictedNoShowPercent: prediction.overbookingAdvice?.predictedNoShowPercent ?? Math.round(prediction.probability * 100) / 10,
      safeOverbookMargin: prediction.overbookingAdvice?.safeOverbookMargin ?? 0,
      factors: prediction.factors,
      createdAt: new Date().toISOString(),
    };

    res.json({ success: true, data: forecast });
  } catch (error) {
    next(error);
  }
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

// POST /api/v1/ai/fraud/analyze
router.post('/fraud/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { username, businessName, domain } = req.body;
    if (!username) {
      res.status(400).json({ success: false, error: 'username is required for analysis' });
      return;
    }

    const report: any = {
      timestamp: new Date().toISOString(),
      target: { username, businessName, domain },
      investigations: [],
      synthesizedRiskScore: 0,
      recommendation: 'APPROVE'
    };

    // 1. Identity correlation via Maigret MCP
    const maigretResult = await osintMCPClient.queryMaigretMCP(username);
    report.investigations.push(maigretResult);
    report.synthesizedRiskScore += maigretResult.riskScoreDelta;

    // 2. Corporate correlation via OpenRegistry MCP
    if (businessName) {
      const registryResult = await osintMCPClient.queryOpenRegistryMCP(businessName);
      report.investigations.push(registryResult);
      report.synthesizedRiskScore += registryResult.riskScoreDelta;
    }

    // 3. Infrastructure Pipeline
    if (domain) {
      const infraResults = await osintMCPClient.queryInfrastructurePipeline(domain);
      report.investigations.push(...infraResults);
      for (const res of infraResults) {
        report.synthesizedRiskScore += res.riskScoreDelta;
      }
    }

    // Agent Synthesis (Mocked LLM Synthesis)
    if (report.synthesizedRiskScore >= 80) {
      report.recommendation = 'QUARANTINE_AND_REVIEW';
      report.summary = `High risk detected. Correlated identity points to threat actor presence or extremely risky infrastructure for ${domain || username}.`;
    } else if (report.synthesizedRiskScore >= 40) {
      report.recommendation = 'REQUIRE_ADDITIONAL_KYC';
      report.summary = `Medium risk detected. Some suspicious findings in corporate registry or social footprint.`;
    } else {
      report.recommendation = 'APPROVE';
      report.summary = `Low risk. Identity and infrastructure appear clean across all queried OSINT sources.`;
    }

    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

export default router;
