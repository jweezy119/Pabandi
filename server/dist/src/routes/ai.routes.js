"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const ai_nlp_service_1 = require("../services/ai.nlp.service");
const noShowPredictor_1 = require("../services/ai/noShowPredictor");
const database_1 = require("../utils/database");
const osintMCPClient_service_1 = require("../services/osint/osintMCPClient.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const tokenomics_1 = require("../config/tokenomics");
const blockchain_service_1 = require("../services/blockchain.service");
const router = (0, express_1.Router)();
/**
 * Monetization + anti-abuse for the brushing-scam scanner, mirroring the guards
 * on the background-check routes: 5 scans / 5 min / IP + a flat $PAB fee
 * debited BEFORE the (real-source) review fetch runs. Stops free reputation
 * harvesting of competitor sellers via the NLP model.
 */
const scannerRateLimiter = (0, express_rate_limit_1.default)({
    windowMs: 5 * 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.ip,
    handler: (_req, res) => res.status(429).json({ success: false, error: 'Rate limit exceeded for scanner. Max 5 scans per 5 minutes. Buy a higher tier for bulk screening.' }),
    standardHeaders: true,
    legacyHeaders: false,
});
async function debitScanFee(userId, fee = tokenomics_1.PAB_FEE_PER_CHECK) {
    const result = await database_1.prisma.wallet.updateMany({
        where: { userId, balance: { gte: fee } },
        data: { balance: { decrement: fee } },
    });
    if (result.count === 0) {
        const w = await database_1.prisma.wallet.findUnique({ where: { userId }, select: { balance: true } });
        return `'Insufficient $PAB balance (have ${w?.balance ?? 0}, need ${fee}). Buy $PAB or top up before scanning — the scanner runs real-source checks, so it's paid.'`;
    }
    return null;
}
router.get('/status', (_req, res) => {
    res.json({
        success: true,
        service: 'ai',
        endpoints: ['/api/v1/ai/status', '/api/v1/ai/models', '/api/v1/ai/nlp/classify', '/api/v1/ai/nlp/generate', '/api/v1/ai/forecast/demand'],
        models: ai_nlp_service_1.aiNlpService.getEnabledModels(),
    });
});
router.post('/forecast/demand', async (req, res, next) => {
    try {
        const { businessId, date, category, groupSize, advanceBookingDays } = req.body || {};
        if (!businessId || !date) {
            res.status(400).json({ success: false, error: 'businessId and date are required' });
            return;
        }
        const business = await database_1.prisma.business.findUnique({
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
        const end = new Date(target.getTime() + 86400000);
        const advanceDays = Math.max(0, Math.floor((today.getTime() - target.getTime()) / -86400000));
        const reservationCount = await database_1.prisma.reservation.count({
            where: { businessId, reservationDate: { gte: target, lt: end } },
        });
        const historical = await database_1.prisma.reservation.findMany({
            where: { businessId, createdAt: { gte: new Date(today.getTime() - 30 * 86400000) } },
            select: { status: true },
        });
        const noShowCount = historical.filter(r => r.status === 'NO_SHOW').length;
        const cancelledCount = historical.filter(r => r.status === 'CANCELLED').length;
        const historyCount = historical.length || 1;
        const averageNoShowRate = noShowCount / historyCount;
        const prediction = await noShowPredictor_1.noShowPredictor.predict({
            customerHistory: { totalReservations: historyCount, noShowCount, cancellationCount: cancelledCount, averageNoShowRate },
            timeFactors: { dayOfWeek: target.getDay(), hour: 19, isWeekend, isHoliday: false },
            bookingFactors: { advanceBookingDays: advanceBookingDays ?? advanceDays, isSameDay: advanceDays <= 0, groupSize: groupSize || 2, hasSpecialRequests: false },
            businessFactors: { averageNoShowRate, businessRating: business.rating ?? undefined, requiresDeposit: false, businessCategory: category || business.category?.toUpperCase() || 'OTHER' },
        });
        const forecast = {
            businessId,
            businessName: business.name,
            date: target.toISOString().split('T')[0],
            weekday: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][target.getDay()],
            confidence: Math.max(0, Math.min(1, 1 - prediction.probability)),
            demandSignal: prediction.riskScore > 65 ? 'high' : prediction.riskScore > 40 ? 'medium' : 'low',
            recommendation: prediction.depositRecommendation.required ? 'Require deposit or release overbook margin carefully.' : 'Standard booking flow acceptable.',
            predictedNoShowPercent: prediction.overbookingAdvice?.predictedNoShowPercent ?? Math.round(prediction.probability * 100) / 10,
            safeOverbookMargin: prediction.overbookingAdvice?.safeOverbookMargin ?? 0,
            factors: prediction.factors,
            createdAt: new Date().toISOString(),
        };
        res.json({ success: true, data: forecast });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/ai/nlp/classify
router.post('/nlp/classify', async (req, res, next) => {
    try {
        const { message } = req.body;
        if (!message) {
            res.status(400).json({ success: false, error: 'message is required' });
            return;
        }
        const classification = await ai_nlp_service_1.aiNlpService.classifyIntentAndLanguage(message);
        res.json({ success: true, data: classification });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/ai/nlp/generate
router.post('/nlp/generate', async (req, res, next) => {
    try {
        const { template, context } = req.body;
        if (!template || !context) {
            res.status(400).json({ success: false, error: 'template and context are required' });
            return;
        }
        const copy = await ai_nlp_service_1.aiNlpService.generateCopy(template, context);
        res.json({ success: true, data: { copy } });
    }
    catch (error) {
        next(error);
    }
});
// GET /api/v1/ai/models
router.get('/models', (req, res) => {
    const models = ai_nlp_service_1.aiNlpService.getEnabledModels();
    res.json({ success: true, data: models });
});
// POST /api/v1/ai/fraud/analyze
router.post('/fraud/analyze', async (req, res, next) => {
    try {
        const { username, businessName, domain } = req.body;
        if (!username) {
            res.status(400).json({ success: false, error: 'username is required for analysis' });
            return;
        }
        const report = {
            timestamp: new Date().toISOString(),
            target: { username, businessName, domain },
            investigations: [],
            synthesizedRiskScore: 0,
            recommendation: 'APPROVE'
        };
        // 1. Identity correlation via Maigret MCP
        const maigretResult = await osintMCPClient_service_1.osintMCPClient.queryMaigretMCP(username);
        report.investigations.push(maigretResult);
        report.synthesizedRiskScore += maigretResult.riskScoreDelta;
        // 2. Corporate correlation via OpenRegistry MCP
        if (businessName) {
            const registryResult = await osintMCPClient_service_1.osintMCPClient.queryOpenRegistryMCP(businessName);
            report.investigations.push(registryResult);
            report.synthesizedRiskScore += registryResult.riskScoreDelta;
        }
        // 3. Infrastructure Pipeline
        if (domain) {
            const infraResults = await osintMCPClient_service_1.osintMCPClient.queryInfrastructurePipeline(domain);
            report.investigations.push(...infraResults);
            for (const res of infraResults) {
                report.synthesizedRiskScore += res.riskScoreDelta;
            }
        }
        // Agent Synthesis (Mocked LLM Synthesis)
        if (report.synthesizedRiskScore >= 80) {
            report.recommendation = 'QUARANTINE_AND_REVIEW';
            report.summary = `High risk detected. Correlated identity points to threat actor presence or extremely risky infrastructure for ${domain || username}.`;
        }
        else if (report.synthesizedRiskScore >= 40) {
            report.recommendation = 'REQUIRE_ADDITIONAL_KYC';
            report.summary = `Medium risk detected. Some suspicious findings in corporate registry or social footprint.`;
        }
        else {
            report.recommendation = 'APPROVE';
            report.summary = `Low risk. Identity and infrastructure appear clean across all queried OSINT sources.`;
        }
        res.json({ success: true, data: report });
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/ai/fraud/fusion — Full-spectrum Dempster-Shafer threat fusion
router.post('/fraud/fusion', async (req, res, next) => {
    try {
        const { userId, username, businessName, domain, walletAddress, transactionAmount, ipAddress, deviceFingerprint } = req.body;
        if (!userId) {
            res.status(400).json({ success: false, error: 'userId is required for fusion analysis' });
            return;
        }
        const { threatFusionEngine } = await Promise.resolve().then(() => __importStar(require('../services/osint/threatFusion.engine')));
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
    }
    catch (error) {
        next(error);
    }
});
// POST /api/v1/ai/daraz-scanner
router.post('/daraz-scanner', auth_middleware_1.authenticate, scannerRateLimiter, async (req, res, next) => {
    try {
        const { sellerUrl, sellerName } = req.body;
        if (!sellerUrl) {
            res.status(400).json({ success: false, error: 'sellerUrl is required' });
            return;
        }
        // Monetization gate: debit $PAB before running real-source checks.
        const feeDeclined = await debitScanFee(req.userId, tokenomics_1.PAB_FEE_PER_CHECK);
        if (feeDeclined)
            return res.status(402).json({ success: false, error: feeDeclined });
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
        const aiResponse = await ai_nlp_service_1.aiNlpService.generateCopy(promptTemplate, promptContext);
        let analysisResult = { isFake: false, trustScore: 85, rationale: "Reviews appear natural.", reviewFarmProbability: 10 };
        try {
            const jsonStr = aiResponse.replace(/```json/gi, '').replace(/```/g, '').trim();
            analysisResult = JSON.parse(jsonStr);
        }
        catch (e) {
            console.error("[Daraz Scanner] Failed to parse LLM JSON:", e);
        }
        // Persist the verdict + anchor it on-chain (fail-open: attestation is best-effort
        // so a down blockchain never breaks the scan response). Mirrors reliability.service.
        let checkId = null;
        let attestationTx = null;
        try {
            const check = await database_1.prisma.backgroundCheck.create({
                data: {
                    subjectType: 'BUSINESS',
                    subjectName: sellerName || 'Unknown Seller',
                    subjectId: sellerName || undefined,
                    subjectWebsite: sellerUrl,
                    requestedBy: req.userId,
                    status: 'COMPLETE',
                    riskScore: analysisResult.trustScore,
                    riskBand: analysisResult.trustScore >= 80 ? 'A' : analysisResult.trustScore >= 50 ? 'B' : 'C',
                    recommendation: analysisResult.isFake ? 'REJECT' : 'PASS',
                    summary: analysisResult.rationale,
                    trigger: 'PRE_BOOKING',
                    pabFee: tokenomics_1.PAB_FEE_PER_CHECK,
                },
            });
            checkId = check.id;
            // Anchor on Solana (mock mode hashes JSON into a bs58 "txHash"; production is
            // stubbed but the call never throws). Use the check id as the reservation ref.
            const att = await blockchain_service_1.blockchainService.logTrustAttestationOnSolana(req.userId, check.id, 'COMPLETED_BOOKING', {
                source: 'DARAZ_SCANNER',
                sellerUrl,
                reviewFarmProbability: analysisResult.reviewFarmProbability,
                trustScore: analysisResult.trustScore,
                isFake: analysisResult.isFake,
            });
            if (att.txHash) {
                attestationTx = att.txHash;
                // Raw UPDATE: the solanaAttestationId column is added idempotently by the
                // BackgroundCheck /migrate self-heal, but Prisma's generated client may
                // not know about it yet — raw SQL avoids a typed-model dependency.
                await database_1.prisma.$executeRawUnsafe(`UPDATE \"BackgroundCheck\" SET \"solanaAttestationId\" = $1 WHERE id = $2`, att.txHash, check.id).catch(() => undefined); // non-fatal: attestation is best-effort
            }
        }
        catch (persistError) {
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
            } });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=ai.routes.js.map