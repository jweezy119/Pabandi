import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { threatFusionEngine } from '../services/osint/threatFusion.engine';
import { adversarialGraphService } from '../services/osint/adversarialGraph.service';
import { behavioralBiometricsService } from '../services/osint/behavioralBiometrics.service';
import { temporalDeceptionDetector } from '../services/osint/temporalDeception.detector';
import { shadowEscrowService } from '../services/osint/shadowEscrow.service';
import { soulboundReputationService } from '../services/osint/soulboundReputation.service';

const router = Router();

/**
 * GET /api/v1/osint/status
 * Returns the status and capabilities of the OSINT intelligence layer.
 */
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    service: 'Pabandi OSINT Intelligence Layer',
    version: '2.0.0',
    engines: [
      { name: 'Threat Fusion Engine', status: 'ACTIVE', algorithm: 'Dempster-Shafer Evidence Theory' },
      { name: 'Adversarial Graph', status: 'ACTIVE', algorithm: 'Louvain Community Detection + Markov Chain Prediction' },
      { name: 'Behavioral Biometrics', status: 'ACTIVE', algorithm: '96-Dimensional Cosine Similarity Matching' },
      { name: 'Temporal Deception Detector', status: 'ACTIVE', algorithm: 'Haversine Geodesic + Shannon Entropy' },
      { name: 'Shadow Escrow (Active Defense)', status: 'ACTIVE', algorithm: 'Honeypot + Crypto Address Extraction' },
      { name: 'Soulbound Reputation NFTs', status: 'ACTIVE', algorithm: 'Dynamic Metadata Mutation' },
      { name: 'OSINT MCP Pipeline', status: 'ACTIVE', algorithm: 'Multi-Tool MCP Orchestration' },
    ],
    mcpTools: ['Maigret', 'OpenRegistry', 'WHOIS', 'VirusTotal', 'Shodan', 'Bright Data'],
  });
});

/**
 * POST /api/v1/osint/fusion/analyze
 * 
 * Full-spectrum threat fusion analysis.
 * Fuses ALL intelligence layers using Dempster-Shafer evidence theory.
 * 
 * Body: {
 *   userId: string,
 *   businessId?: string,
 *   transactionAmount?: number,
 *   username?: string,
 *   domain?: string,
 *   ipAddress?: string,
 *   deviceFingerprint?: string,
 *   walletAddress?: string
 * }
 */
router.post('/fusion/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, ...context } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const verdict = await threatFusionEngine.analyzeFull(userId, context);
    res.json({ success: true, data: verdict });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/constellation/build
 * 
 * Build a threat constellation (adversarial graph) from a seed entity.
 * Maps entire fraud networks using BFS expansion + community detection.
 * 
 * Body: {
 *   seedId: string,
 *   seedType: 'IDENTITY' | 'WALLET' | 'DOMAIN' | 'DEVICE' | 'IP_RANGE',
 *   seedLabel: string,
 *   maxDepth?: number (default: 3)
 * }
 */
router.post('/constellation/build', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { seedId, seedType, seedLabel, maxDepth = 3 } = req.body;
    if (!seedId || !seedType || !seedLabel) {
      res.status(400).json({ success: false, error: 'seedId, seedType, and seedLabel are required' });
      return;
    }

    const report = await adversarialGraphService.buildConstellation(seedId, seedType, seedLabel, maxDepth);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/biometrics/ingest
 * 
 * Ingest a behavioral biometrics session from the client-side SDK.
 * Builds the user's "Digital DNA" profile over time.
 * 
 * Body: {
 *   userId: string,
 *   keystrokes: { interKeyTimings, dwellTimes, flightTimes, errorRate, burstPattern },
 *   mouse: { velocityCurve, hoverHesitations, clickAccuracy, scrollEntropy, straightLineRatio },
 *   navigation: { pageTransitionTimes, clickDepth, searchVsNavigate, sessionDuration, idleGaps }
 * }
 */
router.post('/biometrics/ingest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, keystrokes, mouse, navigation } = req.body;
    if (!userId || !keystrokes || !mouse || !navigation) {
      res.status(400).json({ success: false, error: 'userId, keystrokes, mouse, and navigation data are required' });
      return;
    }

    const result = await behavioralBiometricsService.ingestSession(userId, keystrokes, mouse, navigation);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/biometrics/match
 * 
 * Match a live session against the user's stored behavioral profile.
 * Returns similarity score, bot detection, duress detection, and risk level.
 * 
 * Body: same as /biometrics/ingest
 */
router.post('/biometrics/match', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, keystrokes, mouse, navigation } = req.body;
    if (!userId || !keystrokes || !mouse || !navigation) {
      res.status(400).json({ success: false, error: 'userId, keystrokes, mouse, and navigation data are required' });
      return;
    }

    const result = await behavioralBiometricsService.matchSession(userId, keystrokes, mouse, navigation);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/biometrics/crossmatch
 * 
 * Compare behavioral profiles of two users to detect if they're the same person.
 * Used by the Adversarial Graph for behavioral clone detection.
 * 
 * Body: { userIdA: string, userIdB: string }
 */
router.post('/biometrics/crossmatch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIdA, userIdB } = req.body;
    if (!userIdA || !userIdB) {
      res.status(400).json({ success: false, error: 'userIdA and userIdB are required' });
      return;
    }

    const result = await behavioralBiometricsService.crossMatch(userIdA, userIdB);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/temporal/record
 * 
 * Record a temporal event for chrono-forensic analysis.
 * 
 * Body: {
 *   userId: string,
 *   action: string,
 *   geoLocation?: { latitude, longitude, city?, country? },
 *   clientTimestamp?: number,
 *   sessionId?: string,
 *   metadata?: object
 * }
 */
router.post('/temporal/record', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, action, geoLocation, clientTimestamp, sessionId, metadata } = req.body;
    if (!userId || !action) {
      res.status(400).json({ success: false, error: 'userId and action are required' });
      return;
    }

    temporalDeceptionDetector.recordEvent({
      userId,
      timestamp: Date.now(),
      action,
      geoLocation,
      clientTimestamp,
      sessionId,
      metadata
    });

    res.json({ success: true, data: { recorded: true } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/osint/temporal/analyze/:userId
 * 
 * Run full temporal forensics analysis on a user.
 * Detects impossible travel, timezone paradoxes, session velocity abuse,
 * circadian anomalies, temporal collusion, and timestamp forgery.
 */
router.get('/temporal/analyze/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const report = await temporalDeceptionDetector.analyzeUser(userId);
    res.json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/shadow-escrow/deploy
 * 
 * Manually deploy a shadow escrow honeypot against a suspected scammer.
 * 
 * Body: { sellerId: string, buyerId: string, amount: number, osintRiskScore: number }
 */
router.post('/shadow-escrow/deploy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sellerId, buyerId, amount, osintRiskScore } = req.body;
    if (!sellerId || !buyerId) {
      res.status(400).json({ success: false, error: 'sellerId and buyerId are required' });
      return;
    }

    const result = await shadowEscrowService.deployHoneypot(sellerId, buyerId, amount || 0, osintRiskScore || 90);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/shadow-escrow/spring
 * 
 * Spring the trap on an active shadow escrow. Confiscates funds and extracts intelligence.
 * 
 * Body: { escrowId: string, scammerPayload: object }
 */
router.post('/shadow-escrow/spring', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { escrowId, scammerPayload } = req.body;
    if (!escrowId) {
      res.status(400).json({ success: false, error: 'escrowId is required' });
      return;
    }

    const trapResult = await shadowEscrowService.analyzeAdversaryBehavior(escrowId, scammerPayload || {});
    const result = await shadowEscrowService.springTrap(escrowId, trapResult);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/soulbound/mint
 * 
 * Mint a new Soulbound Reputation NFT for a user.
 * 
 * Body: { userId: string, walletAddress: string }
 */
router.post('/soulbound/mint', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, walletAddress } = req.body;
    if (!userId || !walletAddress) {
      res.status(400).json({ success: false, error: 'userId and walletAddress are required' });
      return;
    }

    const result = await soulboundReputationService.mintReputationToken(userId, walletAddress);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/soulbound/upgrade
 * 
 * Upgrade a Soulbound NFT to OSINT_VERIFIED after passing intelligence checks.
 * 
 * Body: { userId: string, tokenId: string }
 */
router.post('/soulbound/upgrade', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, tokenId } = req.body;
    if (!userId || !tokenId) {
      res.status(400).json({ success: false, error: 'userId and tokenId are required' });
      return;
    }

    const result = await soulboundReputationService.upgradeToOsintVerified(userId, tokenId);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/osint/soulbound/rot
 * 
 * Rot (burn) a Soulbound NFT when a user is flagged as a bad actor.
 * 
 * Body: { userId: string, tokenId: string, reason: string }
 */
router.post('/soulbound/rot', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, tokenId, reason } = req.body;
    if (!userId || !tokenId || !reason) {
      res.status(400).json({ success: false, error: 'userId, tokenId, and reason are required' });
      return;
    }

    const result = await soulboundReputationService.rotToken(userId, tokenId, reason);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
