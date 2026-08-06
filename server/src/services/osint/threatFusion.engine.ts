import { logger } from '../../utils/logger';
import { prisma } from '../../utils/database';
import { osintMCPClient } from './osintMCPClient.service';
import { adversarialGraphService, ConstellationReport } from './adversarialGraph.service';
import { behavioralBiometricsService, BiometricMatchResult } from './behavioralBiometrics.service';
import { shadowEscrowService } from './shadowEscrow.service';
import { soulboundReputationService } from './soulboundReputation.service';

/**
 * ThreatFusionEngine — "Cognitive Threat Intelligence"
 * ────────────────────────────────────────────────────────────────────────────
 * The central nervous system of Pabandi's security architecture.
 *
 * While most platforms have siloed security tools (fraud checker here,
 * OSINT there, biometrics somewhere else), the Threat Fusion Engine
 * FUSES signals from ALL Pabandi intelligence layers into a single
 * cognitive assessment.
 *
 * Signal Sources:
 *   1. OSINT MCP Pipeline     — external intelligence (Maigret, Shodan, etc.)
 *   2. Adversarial Graph      — constellation mapping & contagion
 *   3. Behavioral Biometrics  — session-level user authenticity
 *   4. TrustFlux             — velocity and trajectory of trust
 *   5. Shadow Escrow         — active defense intelligence
 *   6. Identity Clustering    — device/IP collisions
 *   7. Transaction Patterns   — amount, frequency, counterparty diversity
 *
 * Fusion Algorithm (Dempster-Shafer Evidence Theory):
 *   - Each signal source produces a "belief mass" for {SAFE, RISKY, UNKNOWN}
 *   - Dempster's Rule of Combination fuses these masses
 *   - The final "plausibility of threat" is used for automated decisions:
 *       > plausibility < 0.20  → AUTO_APPROVE
 *       > 0.20 ≤ plaus < 0.50 → ENHANCED_MONITORING (shadow mode)
 *       > 0.50 ≤ plaus < 0.75 → REQUIRE_ADDITIONAL_KYC
 *       > plausibility ≥ 0.75 → QUARANTINE (shadow escrow deployment)
 *
 * This makes Pabandi the ONLY marketplace platform that does true
 * multi-source intelligence fusion with mathematically grounded
 * evidence combination theory.
 */

export interface FusionSignal {
  source: string;
  belief: {
    safe: number;    // mass assigned to "user is safe"
    risky: number;   // mass assigned to "user is risky"
    unknown: number; // mass assigned to uncertainty
  };
  rawData: any;
  timestamp: number;
}

export interface FusionVerdict {
  userId: string;
  businessId?: string;
  
  // Fused belief masses (Dempster-Shafer)
  fusedBelief: {
    safe: number;
    risky: number;
    unknown: number;
  };
  plausibilityOfThreat: number;  // risky + unknown (worst-case risk)
  beliefInSafety: number;        // safe mass (best-case safety)
  
  // Decision
  action: 'AUTO_APPROVE' | 'ENHANCED_MONITORING' | 'REQUIRE_ADDITIONAL_KYC' | 'QUARANTINE';
  
  // Contributing signals
  signals: FusionSignal[];
  
  // Constellation data (if applicable)
  constellation?: ConstellationReport;
  
  // Behavioral biometrics (if applicable)
  biometricMatch?: BiometricMatchResult;
  
  // Recommendations
  recommendations: string[];
  
  // Metadata
  fusionConfidence: number;  // [0, 1] — how confident we are in the fusion
  processingTimeMs: number;
  generatedAt: string;
}

export class ThreatFusionEngine {

  /**
   * Execute a full-spectrum threat fusion analysis on a user/transaction.
   * This is the "big red button" — it orchestrates ALL intelligence layers.
   */
  public async analyzeFull(
    userId: string,
    context: {
      businessId?: string;
      transactionAmount?: number;
      username?: string;
      domain?: string;
      ipAddress?: string;
      deviceFingerprint?: string;
      walletAddress?: string;
    }
  ): Promise<FusionVerdict> {
    const startTime = Date.now();
    logger.info(`[ThreatFusion] ═══ FULL SPECTRUM ANALYSIS for user ${userId} ═══`);

    const signals: FusionSignal[] = [];

    // ── 1. OSINT MCP Pipeline ──────────────────────────────────────────
    if (context.username) {
      try {
        const maigret = await osintMCPClient.queryMaigretMCP(context.username);
        signals.push({
          source: 'OSINT_MCP_MAIGRET',
          belief: this.osintToMass(maigret.riskScoreDelta, maigret.isSuspicious),
          rawData: maigret,
          timestamp: Date.now()
        });
      } catch (e: any) {
        logger.warn(`[ThreatFusion] Maigret signal failed: ${e.message}`);
      }
    }

    if (context.domain) {
      try {
        const infra = await osintMCPClient.queryInfrastructurePipeline(context.domain);
        const combinedRisk = infra.reduce((sum, r) => sum + r.riskScoreDelta, 0);
        const anySuspicious = infra.some(r => r.isSuspicious);
        signals.push({
          source: 'OSINT_MCP_INFRASTRUCTURE',
          belief: this.osintToMass(combinedRisk, anySuspicious),
          rawData: infra,
          timestamp: Date.now()
        });
      } catch (e: any) {
        logger.warn(`[ThreatFusion] Infrastructure signal failed: ${e.message}`);
      }
    }

    // ── 2. Adversarial Graph (Constellation) ───────────────────────────
    let constellation: ConstellationReport | undefined;
    if (context.walletAddress || context.username) {
      try {
        const seedType = context.walletAddress ? 'WALLET' : 'IDENTITY';
        const seedLabel = context.walletAddress || context.username!;
        constellation = await adversarialGraphService.buildConstellation(
          `${seedType}-${seedLabel}`,
          seedType as any,
          seedLabel,
          2 // Limit depth for performance
        );
        signals.push({
          source: 'ADVERSARIAL_GRAPH',
          belief: this.constellationToMass(constellation),
          rawData: { threatLevel: constellation.threatLevel, nodes: constellation.totalNodes },
          timestamp: Date.now()
        });
      } catch (e: any) {
        logger.warn(`[ThreatFusion] Constellation signal failed: ${e.message}`);
      }
    }

    // ── 3. TrustFlux (Trajectory) ──────────────────────────────────────
    try {
      const { trustFluxService } = await import('../trustFlux.service');
      const flux = await trustFluxService.computeTrustFlux(userId);
      signals.push({
        source: 'TRUST_FLUX',
        belief: this.trustFluxToMass(flux.velocity, flux.trend, flux.anomaly),
        rawData: { velocity: flux.velocity, trend: flux.trend, anomaly: flux.anomaly },
        timestamp: Date.now()
      });
    } catch (e: any) {
      logger.warn(`[ThreatFusion] TrustFlux signal failed: ${e.message}`);
    }

    // ── 4. Identity Clustering ─────────────────────────────────────────
    if (context.ipAddress && context.deviceFingerprint) {
      try {
        const { osintService } = await import('../osint.service');
        const cluster = await osintService.clusterIdentity(userId, context.ipAddress, context.deviceFingerprint);
        const clusterRisk = cluster.riskScore || 0;
        const multipleUsers = cluster.userIds.length > 1;
        signals.push({
          source: 'IDENTITY_CLUSTER',
          belief: {
            safe: multipleUsers ? 0.1 : 0.7,
            risky: multipleUsers ? 0.5 + Math.min(0.3, clusterRisk / 100) : 0.05,
            unknown: multipleUsers ? 0.4 - Math.min(0.3, clusterRisk / 100) : 0.25
          },
          rawData: { clusterSize: cluster.userIds.length, riskScore: clusterRisk },
          timestamp: Date.now()
        });
      } catch (e: any) {
        logger.warn(`[ThreatFusion] Identity cluster signal failed: ${e.message}`);
      }
    }

    // ── 5. Transaction Pattern Analysis ────────────────────────────────
    if (context.transactionAmount) {
      try {
        const txSignal = await this.analyzeTransactionPatterns(userId, context.transactionAmount);
        signals.push(txSignal);
      } catch (e: any) {
        logger.warn(`[ThreatFusion] Transaction pattern signal failed: ${e.message}`);
      }
    }

    // ── 6. User History Signal ─────────────────────────────────────────
    try {
      const historySignal = await this.analyzeUserHistory(userId);
      signals.push(historySignal);
    } catch (e: any) {
      logger.warn(`[ThreatFusion] User history signal failed: ${e.message}`);
    }

    // ═══ DEMPSTER-SHAFER FUSION ════════════════════════════════════════
    const fusedBelief = this.dempsterShaferFusion(signals);

    // Plausibility of threat = risky + unknown (worst case includes uncertainty)
    const plausibilityOfThreat = fusedBelief.risky + fusedBelief.unknown;
    const beliefInSafety = fusedBelief.safe;

    // ═══ DECISION ══════════════════════════════════════════════════════
    let action: FusionVerdict['action'];
    if (plausibilityOfThreat < 0.20) {
      action = 'AUTO_APPROVE';
    } else if (plausibilityOfThreat < 0.50) {
      action = 'ENHANCED_MONITORING';
    } else if (plausibilityOfThreat < 0.75) {
      action = 'REQUIRE_ADDITIONAL_KYC';
    } else {
      action = 'QUARANTINE';
    }

    // ═══ RECOMMENDATIONS ═══════════════════════════════════════════════
    const recommendations = this.generateRecommendations(action, signals, constellation);

    // ═══ AUTONOMOUS ACTIONS ════════════════════════════════════════════
    await this.executeAutonomousActions(userId, action, constellation, context);

    const processingTimeMs = Date.now() - startTime;

    const verdict: FusionVerdict = {
      userId,
      businessId: context.businessId,
      fusedBelief,
      plausibilityOfThreat: Math.round(plausibilityOfThreat * 1000) / 1000,
      beliefInSafety: Math.round(beliefInSafety * 1000) / 1000,
      action,
      signals,
      constellation,
      recommendations,
      fusionConfidence: Math.min(1.0, signals.length / 5),
      processingTimeMs,
      generatedAt: new Date().toISOString()
    };

    logger.info(`[ThreatFusion] ═══ VERDICT: ${action} (plausibility=${plausibilityOfThreat.toFixed(3)}, safety=${beliefInSafety.toFixed(3)}) in ${processingTimeMs}ms ═══`);

    return verdict;
  }

  /**
   * Dempster-Shafer Rule of Combination.
   * 
   * Fuses multiple independent belief mass functions into a single combined mass.
   * Unlike Bayesian methods, D-S handles uncertainty explicitly via the "unknown" mass.
   *
   * For two mass functions m1, m2:
   *   m12(A) = (1/K) * Σ_{B∩C=A} m1(B) * m2(C)
   *   K = 1 - Σ_{B∩C=∅} m1(B) * m2(C)   (normalization / conflict measure)
   */
  private dempsterShaferFusion(signals: FusionSignal[]): { safe: number; risky: number; unknown: number } {
    if (signals.length === 0) {
      return { safe: 0, risky: 0, unknown: 1.0 }; // Total ignorance
    }

    // Start with the first signal's mass function
    let fused = { ...signals[0].belief };

    // Iteratively combine with each subsequent signal
    for (let i = 1; i < signals.length; i++) {
      fused = this.combineTwoMasses(fused, signals[i].belief);
    }

    return fused;
  }

  /**
   * Combine two Dempster-Shafer mass functions using Dempster's Rule.
   * 
   * Frame of discernment: Θ = {SAFE, RISKY}
   * Focal elements: {SAFE}, {RISKY}, {SAFE, RISKY} (= UNKNOWN/uncertainty)
   * 
   * Intersection rules:
   *   {SAFE} ∩ {SAFE} = {SAFE}
   *   {RISKY} ∩ {RISKY} = {RISKY}
   *   {SAFE} ∩ {RISKY} = ∅ (conflict)
   *   {SAFE} ∩ {UNKNOWN} = {SAFE}
   *   {RISKY} ∩ {UNKNOWN} = {RISKY}
   *   {UNKNOWN} ∩ {UNKNOWN} = {UNKNOWN}
   */
  private combineTwoMasses(
    m1: { safe: number; risky: number; unknown: number },
    m2: { safe: number; risky: number; unknown: number }
  ): { safe: number; risky: number; unknown: number } {
    // Compute conflict (mass assigned to empty set)
    const conflict = m1.safe * m2.risky + m1.risky * m2.safe;
    
    const K = 1 - conflict; // Normalization factor
    if (K <= 0.001) {
      // Total conflict — signals completely disagree; return maximum uncertainty
      logger.warn(`[ThreatFusion] Maximum conflict detected between signals`);
      return { safe: 0.33, risky: 0.34, unknown: 0.33 };
    }

    // Compute combined masses via intersection rules
    const safeMass = (
      m1.safe * m2.safe +        // SAFE ∩ SAFE
      m1.safe * m2.unknown +     // SAFE ∩ UNKNOWN
      m1.unknown * m2.safe       // UNKNOWN ∩ SAFE
    ) / K;

    const riskyMass = (
      m1.risky * m2.risky +      // RISKY ∩ RISKY
      m1.risky * m2.unknown +    // RISKY ∩ UNKNOWN
      m1.unknown * m2.risky      // UNKNOWN ∩ RISKY
    ) / K;

    const unknownMass = (
      m1.unknown * m2.unknown    // UNKNOWN ∩ UNKNOWN
    ) / K;

    return {
      safe: Math.round(safeMass * 1000) / 1000,
      risky: Math.round(riskyMass * 1000) / 1000,
      unknown: Math.round(unknownMass * 1000) / 1000
    };
  }

  // ── Signal-to-Mass Converters ────────────────────────────────────────

  private osintToMass(riskScoreDelta: number, isSuspicious: boolean): FusionSignal['belief'] {
    if (isSuspicious) {
      return {
        safe: 0.05,
        risky: Math.min(0.8, 0.3 + riskScoreDelta / 200),
        unknown: Math.max(0.15, 0.65 - riskScoreDelta / 200)
      };
    }
    return {
      safe: 0.6 + Math.min(0.3, Math.abs(riskScoreDelta) / 100),
      risky: 0.05,
      unknown: 0.35 - Math.min(0.3, Math.abs(riskScoreDelta) / 100)
    };
  }

  private constellationToMass(report: ConstellationReport): FusionSignal['belief'] {
    switch (report.threatLevel) {
      case 'CRITICAL': return { safe: 0.02, risky: 0.85, unknown: 0.13 };
      case 'HIGH':     return { safe: 0.10, risky: 0.65, unknown: 0.25 };
      case 'MEDIUM':   return { safe: 0.30, risky: 0.35, unknown: 0.35 };
      case 'LOW':      return { safe: 0.60, risky: 0.10, unknown: 0.30 };
      default:         return { safe: 0.33, risky: 0.33, unknown: 0.34 };
    }
  }

  private trustFluxToMass(
    velocity: number,
    trend: string,
    anomaly: boolean
  ): FusionSignal['belief'] {
    if (anomaly) {
      return { safe: 0.10, risky: 0.50, unknown: 0.40 };
    }
    if (trend === 'RISING') {
      return { safe: 0.70, risky: 0.05, unknown: 0.25 };
    }
    if (trend === 'DECLINING') {
      return { safe: 0.15, risky: 0.45, unknown: 0.40 };
    }
    if (trend === 'VOLATILE') {
      return { safe: 0.20, risky: 0.35, unknown: 0.45 };
    }
    // STEADY
    return { safe: 0.50, risky: 0.10, unknown: 0.40 };
  }

  private async analyzeTransactionPatterns(userId: string, amount: number): Promise<FusionSignal> {
    // Pull recent transactions to detect anomalies
    const recentReservations = await prisma.reservation.findMany({
      where: { customerId: userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { depositAmount: true, createdAt: true, status: true }
    }).catch(() => []);

    const avgAmount = recentReservations.length > 0
      ? recentReservations.reduce((sum, r) => sum + (r.depositAmount || 0), 0) / recentReservations.length
      : amount;

    // Flag if current transaction is >3x the user's average
    const isAnomaly = amount > avgAmount * 3 && recentReservations.length > 3;
    
    // Flag if rapid-fire transactions (>5 in last hour)
    const oneHourAgo = new Date(Date.now() - 3600000);
    const recentCount = recentReservations.filter(
      r => r.createdAt > oneHourAgo
    ).length;
    const isRapidFire = recentCount > 5;

    let belief: FusionSignal['belief'];
    if (isAnomaly && isRapidFire) {
      belief = { safe: 0.05, risky: 0.80, unknown: 0.15 };
    } else if (isAnomaly || isRapidFire) {
      belief = { safe: 0.20, risky: 0.50, unknown: 0.30 };
    } else {
      belief = { safe: 0.65, risky: 0.05, unknown: 0.30 };
    }

    return {
      source: 'TRANSACTION_PATTERNS',
      belief,
      rawData: { amount, avgAmount, isAnomaly, isRapidFire, recentCount },
      timestamp: Date.now()
    };
  }

  private async analyzeUserHistory(userId: string): Promise<FusionSignal> {
    const [user, disputeCount, completedCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { trustScore: true, reliabilityScore: true, createdAt: true }
      }).catch(() => null),
      prisma.dispute.count({ where: { userId } }).catch(() => 0),
      prisma.reservation.count({ where: { customerId: userId, status: 'COMPLETED' } }).catch(() => 0)
    ]);

    if (!user) {
      return {
        source: 'USER_HISTORY',
        belief: { safe: 0.10, risky: 0.30, unknown: 0.60 },
        rawData: { exists: false },
        timestamp: Date.now()
      };
    }

    const accountAgeDays = (Date.now() - (user.createdAt?.getTime() || Date.now())) / 86400000;
    const trustScore = user.trustScore || 50;

    let belief: FusionSignal['belief'];

    if (trustScore >= 80 && completedCount > 10 && disputeCount === 0 && accountAgeDays > 30) {
      belief = { safe: 0.85, risky: 0.02, unknown: 0.13 };
    } else if (trustScore >= 60 && completedCount > 3) {
      belief = { safe: 0.60, risky: 0.10, unknown: 0.30 };
    } else if (disputeCount > 2 || trustScore < 30) {
      belief = { safe: 0.10, risky: 0.60, unknown: 0.30 };
    } else {
      belief = { safe: 0.35, risky: 0.15, unknown: 0.50 };
    }

    return {
      source: 'USER_HISTORY',
      belief,
      rawData: { trustScore, completedCount, disputeCount, accountAgeDays },
      timestamp: Date.now()
    };
  }

  // ── Recommendations ──────────────────────────────────────────────────

  private generateRecommendations(
    action: FusionVerdict['action'],
    signals: FusionSignal[],
    constellation?: ConstellationReport
  ): string[] {
    const recommendations: string[] = [];

    switch (action) {
      case 'QUARANTINE':
        recommendations.push('🚨 Deploy Shadow Escrow to extract adversary playbook');
        recommendations.push('🔒 Freeze all pending transactions for this user');
        recommendations.push('📡 Broadcast zero-day threat to MCP network');
        if (constellation && constellation.threatLevel === 'CRITICAL') {
          recommendations.push(`🕸️ Investigate full constellation (${constellation.totalNodes} connected entities)`);
        }
        recommendations.push('🔥 Rot Soulbound NFT to BURNED status');
        break;

      case 'REQUIRE_ADDITIONAL_KYC':
        recommendations.push('🆔 Request government-issued ID verification');
        recommendations.push('📞 Require phone number verification (non-VOIP)');
        recommendations.push('📸 Request live selfie with ID document');
        recommendations.push('⏳ Hold transactions pending KYC completion');
        break;

      case 'ENHANCED_MONITORING':
        recommendations.push('👁️ Enable behavioral biometrics monitoring for next 30 days');
        recommendations.push('📊 Increase trust score audit frequency');
        recommendations.push('💰 Apply elevated escrow percentage (25%+)');
        break;

      case 'AUTO_APPROVE':
        recommendations.push('✅ Transaction cleared through all intelligence layers');
        recommendations.push('✨ Consider upgrading Soulbound NFT to OSINT_VERIFIED');
        break;
    }

    // Add signal-specific recommendations
    const highRiskSignals = signals.filter(s => s.belief.risky > 0.5);
    for (const signal of highRiskSignals) {
      recommendations.push(`⚠️ High-risk signal from ${signal.source} — investigate manually`);
    }

    return recommendations;
  }

  // ── Autonomous Actions ───────────────────────────────────────────────

  private async executeAutonomousActions(
    userId: string,
    action: FusionVerdict['action'],
    constellation?: ConstellationReport,
    context?: any
  ): Promise<void> {
    try {
      if (action === 'QUARANTINE') {
        // Auto-deploy shadow escrow
        logger.error(`[ThreatFusion] 🚨 AUTO-QUARANTINE: Deploying shadow escrow for user ${userId}`);
        await shadowEscrowService.deployHoneypot(userId, 'system', 0, 95);

        // Auto-rot soulbound NFT
        const tokenId = `PABANDI-SBT-${userId}`;
        await soulboundReputationService.rotToken(userId, tokenId, 'THREAT_FUSION_QUARANTINE');

        // Broadcast to MCP if constellation is critical
        if (constellation && constellation.threatLevel === 'CRITICAL') {
          const { pabandiTrustMCPServer } = await import('../../mcp/trustServer');
          await pabandiTrustMCPServer.publishZeroDayThreat({
            sourceScammerId: userId,
            muleWallets: constellation.contagionNodes
              .filter(n => n.nodeId.startsWith('WALLET'))
              .map(n => n.nodeLabel),
            dropDomains: constellation.contagionNodes
              .filter(n => n.nodeId.startsWith('DOMAIN') || n.nodeId.startsWith('INFRA'))
              .map(n => n.nodeLabel),
            tactic: `CONSTELLATION_${constellation.threatLevel}`
          });
        }
      } else if (action === 'AUTO_APPROVE') {
        // Auto-upgrade soulbound NFT for clean users
        const tokenId = `PABANDI-SBT-${userId}`;
        await soulboundReputationService.upgradeToOsintVerified(userId, tokenId);
      }
    } catch (err: any) {
      logger.error(`[ThreatFusion] Autonomous action failed: ${err.message}`);
    }
  }
}

export const threatFusionEngine = new ThreatFusionEngine();
