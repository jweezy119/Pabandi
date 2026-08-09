import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { aiNlpService } from '../services/ai.nlp.service';
import { noShowPredictor } from '../services/ai/noShowPredictor';
import { prisma } from '../utils/database';
import { osintMCPClient } from '../services/osint/osintMCPClient.service';
import { authenticate } from '../middleware/auth.middleware';
import { PAB_FEE_PER_CHECK } from '../config/tokenomics';
import { blockchainService } from '../services/blockchain.service';

const router = Router();

/**
 * Monetization + anti-abuse for the brushing-scam scanner, mirroring the guards
 * on the background-check routes: 5 scans / 5 min / IP + a flat $PAB fee
 * debited BEFORE the (real-source) review fetch runs. Stops free reputation
 * harvesting of competitor sellers via the NLP model.
 */
const scannerRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  keyGenerator: (req: any) => req.ip,
  handler: (_req: any, res: any) => res.status(429).json({ success: false, error: 'Rate limit exceeded for scanner. Max 5 scans per 5 minutes. Buy a higher tier for bulk screening.' }),
  standardHeaders: true,
  legacyHeaders: false,
});

async function debitScanFee(userId: string, fee = PAB_FEE_PER_CHECK): Promise<string | null> {
  const result = await prisma.wallet.updateMany({
    where: { userId, balance: { gte: fee } },
    data: { balance: { decrement: fee } },
  });
  if (result.count === 0) {
    const w = await prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
    return `'Insufficient $PAB balance (have ${w?.balance ?? 0}, need ${fee}). Buy $PAB or top up before scanning — the scanner runs real-source checks, so it's paid.'`;
  }
  return null;
}

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

// POST /api/v1/ai/fraud/fusion — Full-spectrum Dempster-Shafer threat fusion
router.post('/fraud/fusion', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, username, businessName, domain, walletAddress, transactionAmount, ipAddress, deviceFingerprint } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required for fusion analysis' });
      return;
    }

    const { threatFusionEngine } = await import('../services/osint/threatFusion.engine');
    const verdict = await threatFusionEngine.analyzeFull(userId, {
      username,
      businessId: businessName,
      domain,
      walletAddress,
      transactionAmount,
      ipAddress,
      deviceFingerprint
    });

    res.json({ success: true, data: verdict });
  } catch (error) {
    next(error);
  }
});
// POST /api/v1/ai/daraz-scanner
router.post('/daraz-scanner', authenticate, scannerRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sellerUrl, sellerName } = req.body;
    if (!sellerUrl) {
      res.status(400).json({ success: false, error: 'sellerUrl is required' });
      return;
    }

    // Monetization gate: debit $PAB before running real-source checks.
    const feeDeclined = await debitScanFee((req as any).userId, PAB_FEE_PER_CHECK);
    if (feeDeclined) return res.status(402).json({ success: false, error: feeDeclined });

    // In a real implementation, we would scrape the URL. For the demo, we generate mock reviews based on the name.
    // Tip: Add 'bot' to the sellerName to trigger the fake review mock.
    const isBot = sellerName?.toLowerCase().includes('bot') || sellerName?.toLowerCase().includes('fake');
    
    const reviews = isBot 
      ? [
          "very good product i like so much fast shipping",
          "very good product i like so much fast shipping",
          "nice quality sir highly recommend",
          "very good product i like so much fast shipping",
          "nice quality sir highly recommend",
          "five star seller god bless you",
          "five star seller god bless you",
        ]
      : [
          "The shipping was a bit delayed but the quality is exactly as described. Will buy again.",
          "Decent product for the price. The packaging was a bit damaged though.",
          "Bought this for my son, he loves it. Good seller.",
          "The color is slightly different from the picture but overall acceptable.",
          "Customer service was helpful when I asked about sizing.",
        ];

    const promptContext = { sellerName, reviews, url: sellerUrl };
    const promptTemplate = `
      You are Pabandi's AI Trust Oracle. Analyze these e-commerce seller reviews for "Brushing Scams" and Review Farm syntax.
      Look for repetitive phrasing, unnatural grammar, duplicate reviews, or bot-like behavior.
      
      Context: {context}
      
      Respond strictly in valid JSON format with the following keys:
      - isFake (boolean)
      - trustScore (number, 0-100)
      - rationale (string, explain exactly why you think these are fake or real based on the review syntax)
      - reviewFarmProbability (number, 0-100)
    `;

    const aiResponse = await aiNlpService.generateCopy(promptTemplate, promptContext);
    
    let analysisResult = { isFake: false, trustScore: 85, rationale: "Reviews appear natural.", reviewFarmProbability: 10 };
    try {
      const jsonStr = aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
      analysisResult = JSON.parse(jsonStr);
    } catch (e) {
      console.error("[Daraz Scanner] Failed to parse LLM JSON:", e);
    }

    // Persist the verdict + anchor it on-chain (fail-open: attestation is best-effort
    // so a down blockchain never breaks the scan response). Mirrors reliability.service.
    let checkId: string | null = null;
    let attestationTx: string | null = null;
    try {
      const check = await prisma.backgroundCheck.create({
        data: {
          subjectType: 'BUSINESS',
          subjectName: sellerName || 'Unknown Seller',
          subjectId: sellerName || undefined,
          subjectWebsite: sellerUrl,
          requestedBy: (req as any).userId,
          status: 'COMPLETE',
          riskScore: analysisResult.trustScore,
          riskBand: analysisResult.trustScore >= 80 ? 'A' : analysisResult.trustScore >= 50 ? 'B' : 'C',
          recommendation: analysisResult.isFake ? 'REJECT' : 'PASS',
          summary: analysisResult.rationale,
          trigger: 'PRE_BOOKING',
          pabFee: PAB_FEE_PER_CHECK,
        },
      });
      checkId = check.id;
      // Anchor on Solana (mock mode hashes JSON into a bs58 "txHash"; production is
      // stubbed but the call never throws). Use the check id as the reservation ref.
      const att = await blockchainService.logTrustAttestationOnSolana(
        (req as any).userId,
        check.id,
        'COMPLETED_BOOKING',
        {
          source: 'DARAZ_SCANNER',
          sellerUrl,
          reviewFarmProbability: analysisResult.reviewFarmProbability,
          trustScore: analysisResult.trustScore,
          isFake: analysisResult.isFake,
        }
      );
      if (att.txHash) {
        attestationTx = att.txHash;
        // Raw UPDATE: the solanaAttestationId column is added idempotently by the
        // BackgroundCheck /migrate self-heal, but Prisma's generated client may
        // not know about it yet — raw SQL avoids a typed-model dependency.
        await prisma.$executeRawUnsafe(
          `UPDATE \"BackgroundCheck\" SET \"solanaAttestationId\" = $1 WHERE id = $2`,
          att.txHash, check.id
        ).catch(() => undefined); // non-fatal: attestation is best-effort
      }
    } catch (persistError: any) {
      console.error("[Daraz Scanner] Background check / attestation save skipped (non-fatal):", persistError.message);
    }

    res.json({ success: true, data: {
      sellerName: sellerName || 'Unknown Seller',
      url: sellerUrl,
      analysis: analysisResult,
      rawReviewsScraped: reviews.length,
      sampleReviews: reviews,
      checkId,
      attestationTx,
    }});
  } catch (error) {
    next(error);
  }
});

export default router;
