LP Marketplace Implementation Plan

This document outlines the comprehensive liquidity provider marketplace system that enables competitive bidding for USDC→PKR offramp jobs.

## System Architecture

### 1. LP Registry & Profiles
```typescript
// server/src/models/lp.ts
interface LiquidityProvider {
  id: string;
  name: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  
  // Performance metrics
  successRate: number; // 0-100
  averageExecutionSpeed: number; // seconds
  completionRate: number; // completed / attempted
  customerRating: number; // 1-5 stars
  
  // Financial capacity
  dailyLimit: number; // max USD per day
  currentVolume: number; // today's volume
  feeStructure: FeeTier;
  
  // Geographic coverage
  supportedRAAS: string[]; // ['JAZZCASH', 'EASYPASA', 'RAST', etc.]
  operationalRegions: string[]; // ['karachi', 'lahore', 'islamabad']
  
  // Technical capabilities
  apiRateLimit: number; // requests per minute
  webhookUrls: string[];
  supportedPaymentMethods: string[];
  
  // Trust & compliance
  verified: boolean;
  kycLevel: 'BASIC' | 'VERIFIED' | 'ENTERPRISE';
  riskScore: number; // 0-100 (lower = better)
  
  // Analytics
  last24hSuccess: number;
  last24hSpeedP95: number;
  customerSatisfaction: number;
}
```

### 2. Customer Intent System
```typescript
// server/src/models/intent.ts
interface OfframpIntent {
  id: string;
  customerId: string;
  
  // Request details
  amount: number; // USD
  targetRAAS: string; // destination wallet type
  ratePreference: RatePreference;
  deadline?: number; // optional deadline for priority
  
  // Status
  status: 'OPEN' | 'MATCHED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  createdAt: Date;
  expiresAt: Date;
  
  // Matching results
  matchedLP?: string;
  assignedRate?: number;
  executionTime?: number;
}
```

### 3. Matching Engine
```typescript
// server/src/services/lpMatchingEngine.ts
class LMPricingEngine {
  // Competitive bidding algorithm
  async matchIntent(intent: OfframpIntent, availableLPs: LiquidityProvider[]): Promise<LPMatchResult> {
    
    // Step 1: Filter eligible LPs
    const eligibleLPs = this.filterEligibleLPs(intent, availableLPs);
    
    // Step 2: Calculate competitive scores
    const scoredLPs = eligibleLPs.map(lp => ({
      lp,
      score: this.calculateMatchScore(intent, lp),
      estimatedTime: this.estimateExecutionTime(intent, lp),
      riskFactor: lp.riskScore,
      capacity: lp.remainingCapacity(intent.amount),
      speedBonus: this.calculateSpeedBonus(lp),
      reliabilityBonus: this.calculateReliabilityBonus(lp),
    }));
    
    // Step 3: Rank by composite score
    scoredLPs.sort((a, b) => b.score - a.score);
    
    // Step 4: Select best match with capacity
    const match = scoredLPs.find(lp => lp.capacity >= intent.amount);
    
    if (!match) return { success: false, reason: 'No capacity available' };
    
    return {
      success: true,
      matchedLP: match.lp,
      assignedRate: this.calculateFinalRate(match, intent),
      estimatedExecutionTime: match.estimatedTime,
      confidence: match.score / 100,
    };
  }
}
```

### 4. LP Dashboard API
```typescript
// server/src/controllers/lpController.ts
class LPController {
  // Register new LP
  async register(req: Request, res: Response) {
    const lpData = req.body;
    const lp = await prisma.liquidityProvider.create({
      data: {
        id: generateId('lp_'),
        ...lpData,
        tier: this.calculateTier(lpData),
        riskScore: await this.calculateInitialRiskScore(lpData),
      }
    });
    
    return res.json({ success: true, lpId: lp.id });
  }
  
  // LP submits bid for intent
  async submitBid(req: Request, res: Response) {
    const { intentId, proposedRate, estimatedTime, capacity } = req.body;
    const lpId = req.user.lpId;
    
    const intent = await prisma.offrampIntent.findUnique({ where: { id: intentId } });
    if (!intent || intent.status !== 'OPEN') {
      return res.status(400).json({ error: 'Intent not available' });
    }
    
    // Create bid record
    const bid = await prisma.lpBid.create({
      data: {
        id: generateId('bid_'),
        intentId,
        lpId,
        proposedRate,
        estimatedTime,
        capacity,
        timestamp: new Date(),
        status: 'ACTIVE',
      }
    });
    
    // Notify matching engine
    await this.triggerMatching(intentId);
    
    return res.json({ success: true, bidId: bid.id });
  }
  
  // Get LP performance dashboard
  async getLPDashboard(req: Request, res: Response) {
    const lpId = req.user.lpId;
    const { period = '24h' } = req.query;
    
    const dashboard = await this.calculateLPDashboard(lpId, period as string);
    
    return res.json({
      success: true,
      dashboard,
      rankings: await this.getLPRankings(period as string),
    });
  }
}
```

### 5. Settlement Automation
```typescript
// server/src/services/settlementService.ts
class SettlementService {
  // Execute matched intent
  async executeSettlement(intentId: string, lpId: string): Promise<SettlementResult> {
    const intent = await prisma.offrampIntent.findUnique({
      where: { id: intentId },
      include: { customer: true, lp: true }
    });
    
    if (!intent || intent.status !== 'MATCHED') {
      throw new Error('Intent not in matched state');
    }
    
    // Start settlement process
    const settlement = await prisma.settlement.create({
      data: {
        id: generateId('settle_'),
        intentId,
        lpId,
        status: 'PENDING',
        createdAt: new Date(),
      }
    });
    
    // Lock customer USDC
    const usdcLocked = await this.lockUSDC(intent.customerId, intent.amount);
    
    // Start LP work timer
    await this.startExecutionTimer(settlement.id, intent.lp.estimatedExecutionTime);
    
    return { settlementId: settlement.id, usdcLocked };
  }
  
  // Verify receipt and release funds
  async verifyReceipt(settlementId: string, receiptData: ReceiptData): Promise<SettlementResult> {
    const settlement = await prisma.settlement.findUnique({
      where: { id: settlementId },
      include: { intent: true, lp: true }
    });
    
    // AI-powered receipt verification
    const verification = await this.verifyReceiptWithAI(receiptData, settlement.intent);
    
    if (!verification.isValid) {
      await this.processDispute(settlementId, verification.reason);
      return { settlementId, status: 'DISPUTED' };
    }
    
    // Release funds to LP
    await this.releaseUSDC(settlement.intent.customerId, settlement.lpId, settlement.intent.amount);
    
    // Deliver PKR to customer
    await this.deliverPKR(settlement.intent.customerId, verification.amount, verification.raas);
    
    // Update records
    await prisma.settlement.update({
      where: { id: settlementId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        verification,
      }
    });
    
    return { settlementId, status: 'COMPLETED' };
  }
}
```

### 6. Rating & Review System
```typescript
// server/src/services/ratingService.ts
class RatingService {
  // Submit rating for LP
  async submitRating(lpId: string, ratingData: RatingData): Promise<void> {
    const rating = await prisma.lpRating.create({
      data: {
        id: generateId('rating_'),
        lpId,
        customerId: ratingData.customerId,
        intentId: ratingData.intentId,
        score: ratingData.score, // 1-5
        comment: ratingData.comment,
        category: ratingData.category, // 'speed', 'reliability', 'professionalism'
        createdAt: new Date(),
      }
    });
    
    // Update LP profile with new rating
    await this.updateLPRating(lpId);
    
    // Trigger rank recalculation
    await this.recalculateLPRankings();
  }
  
  // Get LP detailed profile with ratings
  async getLPProfile(lpId: string): Promise<LPProfile> {
    const lp = await prisma.liquidityProvider.findUnique({
      where: { id: lpId },
      include: {
        ratings: {
          select: {
            score: true,
            comment: true,
            category: true,
            createdAt: true,
            customer: { select: { firstName: true } }
          }
        }
      }
    });
    
    return this.buildLPProfile(lp);
  }
}
```

### 7. Analytics & Monitoring
```typescript
// server/src/services/lpAnalyticsService.ts
class LPAnalyticsService {
  // Get marketplace metrics
  async getMarketplaceMetrics(): Promise<MarketplaceMetrics> {
    const [totalLPs, activeIntents, averageFillTime, totalVolume] = await Promise.all([
      prisma.liquidityProvider.count(),
      prisma.offrampIntent.count({ where: { status: 'OPEN' } }),
      this.calculateAverageFillTime(),
      this.calculateTotalVolume24h(),
    ]);
    
    return {
      totalLPs,
      activeIntents,
      averageFillTime: this.formatDuration(averageFillTime),
      totalVolume24h: this.formatCurrency(totalVolume),
      fillRate: this.calculateFillRate(),
      customerSatisfaction: this.calculateCSAT(),
    };
  }
  
  // LP performance reports
  async getLPPerformanceReport(lpId: string, period: string): Promise<LPPerformanceReport> {
    const startDate = this.getPeriodStart(period);
    
    const [metrics, intents, ratings] = await Promise.all([
      this.calculateLPMetrics(lpId, startDate),
      prisma.offrampIntent.findMany({
        where: { 
          lpId,
          createdAt: { gte: startDate }
        }
      }),
      prisma.lpRating.findMany({
        where: { lpId },
        include: { customer: true }
      })
    ]);
    
    return {
      lpId,
      period,
      metrics,
      intentsSummary: this.summarizeIntents(intents),
      ratingsSummary: this.summarizeRatings(ratings),
      trends: await this.getLPTrends(lpId, period),
    };
  }
}
```

### 8. API Routes
```typescript
// server/src/routes/lp.routes.ts
import { Router } from 'express';
const router = Router();

// LP Registration & Profile
router.post('/lps/register', lpController.register);
router.get('/lps/profile', lpController.getLPDashboard);
router.patch('/lps/profile', lpController.updateLPProfile);

// Marketplace
router.get('/lps', lpController.getAvailableLPs);
router.get('/intents/open', lpController.getOpenIntents);
router.post('/intents/:id/bid', lpController.submitBid);

// Matching & Execution
router.post('/intents/:id/match', matchingEngine.matchIntent);
router.post('/settlements/:id/verify', settlementService.verifyReceipt);

// Ratings & Reviews
router.post('/ratings/submit', ratingService.submitRating);
router.get('/lps/:id/ratings', ratingService.getLPRatings);

// Analytics
router.get('/analytics/marketplace', analyticsService.getMarketplaceMetrics);
router.get('/lps/:id/performance', analyticsService.getLPPerformanceReport);

export default router;
```

## Implementation Priorities

1. **Phase 1**: Core LP registration and intent matching
2. **Phase 2**: Rating system and performance tracking
3. **Phase 3**: Competitive bidding with dynamic pricing
4. **Phase 4**: Advanced analytics and ranking algorithms
5. **Phase 5**: AI-powered optimization and automation

This system creates a transparent, competitive marketplace where LPs are rewarded for speed, reliability, and quality, while customers get the best rates and guaranteed service.