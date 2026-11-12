import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { apiLimiter, writeLimiter } from '../middleware/rateLimit.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { getAttestationsForPassport } from '../services/onchain-attestation.service';
import { signVerifiableCredential } from '../trust/vcKeys';
import { verifyTrustDisclosure } from '../trust/disclosure.service';
import {
  getBusinessTrustMetrics,
  generateMockZkSignature,
  verifyZkTrustProof,
} from '../services/zkTrustProof.service';
import { TrustPassportPayload } from '../types/trustPassport.types';

const router = Router();
const VC_EXPIRY_HOURS = 24;

// Strict rate limiter for the public verification endpoint (max 30 requests per minute per IP)
const verifyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    isValid: false,
    error: 'Too many verification requests. Rate limit exceeded (30 req/min).',
  },
});

/**
 * ====================================================================
 * ZK TRUST PASSPORT ENDPOINTS
 * ====================================================================
 */

/**
 * Endpoint 1: GET /api/v1/trust/passport/me
 * Requires standard authentication.
 * Returns the current logged-in business's Trust Score and Dispute Rate.
 */
router.get('/passport/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const metrics = await getBusinessTrustMetrics(userId);

    return res.json({
      success: true,
      data: {
        subjectId: metrics.subjectId,
        businessName: metrics.businessName,
        trustScore: metrics.trustScore,
        disputeRate: metrics.disputeRate,
      },
      trustScore: metrics.trustScore,
      disputeRate: metrics.disputeRate,
    });
  } catch (error: any) {
    logger.error(`[Trust] passport me error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});

/**
 * Endpoint 2: POST /api/v1/trust/passport/generate
 * Requires standard authentication.
 * Accepts { minScore: number, maxDisputeRate: number }.
 * Verifies the business actually meets these criteria.
 * Generates TrustPassportPayload or returns 400 Bad Request.
 */
router.post('/passport/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const { minScore, maxDisputeRate } = req.body ?? {};

    if (typeof minScore !== 'number' || typeof maxDisputeRate !== 'number') {
      return res.status(400).json({
        error: 'minScore and maxDisputeRate must be valid numbers',
      });
    }

    const metrics = await getBusinessTrustMetrics(userId);

    // Verify the business actually meets these criteria
    if (metrics.trustScore < minScore || metrics.disputeRate > maxDisputeRate) {
      return res.status(400).json({
        error: 'Your current trust score does not meet the requested predicate.',
      });
    }

    const issuedAt = Date.now();
    const predicates = {
      trustScore: `>${minScore}`,
      disputeRate: `<${maxDisputeRate}%`,
    };

    const signature = generateMockZkSignature('Pabandi', metrics.subjectId, predicates, issuedAt);

    const proofPayload: TrustPassportPayload = {
      issuer: 'Pabandi',
      subjectId: metrics.subjectId,
      issuedAt,
      predicates,
      signature,
    };

    return res.json({
      success: true,
      data: proofPayload,
      ...proofPayload,
    });
  } catch (error: any) {
    logger.error(`[Trust] passport generate error: ${error.message}`);
    return res.status(500).json({
      error: error.message || 'Failed to generate trust passport proof',
    });
  }
});

/**
 * Endpoint 3: POST /api/v1/trust/passport/verify
 * Public route (no auth required).
 * Requires strict rate limit (30 requests per minute per IP).
 * Accepts { proof_payload: TrustPassportPayload }.
 * Returns { isValid: true, verifiedPredicates: ["trust_score > 800", "dispute_rate < 2%"] }.
 */
router.post('/passport/verify', verifyRateLimiter, async (req: Request, res: Response) => {
  try {
    const proofPayload = req.body?.proof_payload || req.body?.payload || req.body;

    const result = verifyZkTrustProof(proofPayload);

    if (!result.isValid) {
      return res.status(400).json({
        isValid: false,
        error: result.error || 'Verification failed',
      });
    }

    return res.json({
      isValid: true,
      verifiedPredicates: result.verifiedPredicates,
    });
  } catch (error: any) {
    logger.error(`[Trust] passport verify error: ${error.message}`);
    return res.status(500).json({
      isValid: false,
      error: error.message || 'Verification processing error',
    });
  }
});


function publicScores(passport: any) {
  return {
    payment: passport.paymentScore ?? 500,
    showUp: passport.showUpScore ?? 500,
    delivery: passport.deliveryScore ?? 500,
    tenancy: passport.tenancyScore ?? 500,
    freight: passport.freightScore ?? 500,
  };
}

/**
 * POST /api/v1/trust/verify-disclosure
 *
 * Check a trust disclosure someone has shown you.
 *
 * Public and stateless on purpose. A business verifying a client needs no account
 * with us and no access to our database — only the published public key, which is
 * already served at /.well-known/pabandi-keys.json. That is what makes the credential
 * worth anything to a stranger: it can be checked by someone who trusts the key and
 * nothing else about us.
 *
 * `audienceBusinessId` is checked against the credential's `aud`. Passing it is what
 * turns "this proof is genuine" into "this proof was made FOR you"; omitting it
 * answers only the first, which is the right default for a verifier who simply wants
 * to inspect it.
 *
 * `threshold` asks the question the verifier actually has: does this clear the bar
 * for the terms I am about to offer? The answer is a boolean, not the underlying
 * score — the score was never in the credential.
 */
router.post('/verify-disclosure', async (req: Request, res: Response) => {
  try {
    const { credential, audienceBusinessId, threshold } = req.body || {};
    if (typeof credential !== 'string' || !credential.trim()) {
      return res.status(400).json({ success: false, error: 'credential is required' });
    }

    const parsedThreshold = Number(threshold);
    const result = verifyTrustDisclosure(credential, {
      audienceBusinessId:
        typeof audienceBusinessId === 'string' && audienceBusinessId ? audienceBusinessId : undefined,
      threshold:
        Number.isFinite(parsedThreshold) && parsedThreshold >= 0 && parsedThreshold <= 100
          ? parsedThreshold
          : undefined,
    });

    // A failed verification is a 200 with `valid: false`, not an error status. It is a
    // successful check that came back negative — an expired proof is a fact about the
    // proof, not a fault with the request.
    res.json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`[Trust] disclosure verification error: ${error.message}`);
    res.status(500).json({ success: false, error: 'Could not verify the proof' });
  }
});

/**
 * GET /api/v1/trust/resolve/:identifier
 * identifier can be: email, wallet address, github username, phone
 * Returns the linked TrustPassport with public scores only
 */
router.get('/resolve/:identifier', apiLimiter, async (req: Request, res: Response) => {
  try {
    const identifier = req.params.identifier;
    if (!identifier) {
      return res.status(400).json({ success: false, error: 'identifier is required' });
    }

    let passport: any = null;

    if (identifier.includes('@')) {
      passport = await prisma.trustPassport.findFirst({
        where: { userId: (await prisma.user.findUnique({ where: { email: identifier } }))?.id },
      });
    } else if (identifier.startsWith('0x') || identifier.length >= 32) {
      passport = await prisma.trustPassport.findFirst({
        where: { OR: [{ walletAddress: identifier }, { userId: (await prisma.user.findFirst({ where: { walletAddress: identifier } }))?.id }] },
      });
    } else {
      passport = await prisma.trustPassport.findFirst({
        where: { OR: [{ handle: { equals: identifier } }, { providerRef: identifier }] },
      });
    }

    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Passport not found or private' });
    }

    return res.json({
      success: true,
      data: {
        handle: passport.handle,
        displayName: passport.displayName,
        category: passport.category,
        walletAddress: passport.walletAddress,
        claimsCount: passport.claimsCount,
        scores: publicScores(passport),
        verifiedIdentity: passport.verifiedIdentity,
        fraudFlag: passport.fraudFlag,
        issuedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error(`[Trust] resolve error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/trust/credential/:passportId
 * Returns a signed JWT verifiable credential for the passport
 */
router.get('/credential/:passportId', writeLimiter, async (req: Request, res: Response) => {
  try {
    const passportId = req.params.passportId;
    if (!passportId) {
      return res.status(400).json({ success: false, error: 'passportId is required' });
    }

    const passport = await prisma.trustPassport.findUnique({ where: { id: passportId } });
    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Passport not found or private' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + VC_EXPIRY_HOURS * 60 * 60 * 1000);

    const payload = {
      iss: 'https://pabandi.com',
      sub: passport.id,
      handle: passport.handle,
      displayName: passport.displayName,
      scores: publicScores(passport),
      verifiedEvents: passport.claimsCount,
      verifiedIdentity: passport.verifiedIdentity,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    // Signed with the ES256 VC keypair, not with JWT_SECRET.
    //
    // It used to be signed with the HS256 application secret, which is what made
    // the credential unverifiable: the published public key was derived from that
    // same secret (and threw), so a third party could only "verify" a credential
    // by holding the application's signing secret. Anyone with it could mint a
    // credential for any passport. See trust/vcKeys.ts.
    const signedJwt = signVerifiableCredential(payload as Record<string, unknown>, VC_EXPIRY_HOURS * 60 * 60);

    return res.json({
      success: true,
      data: {
        credential: signedJwt,
        publicKeyUrl: `${req.protocol}://${req.get('host')}/.well-known/pabandi-keys.json`,
      },
    });
  } catch (error: any) {
    logger.error(`[Trust] credential error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/trust/public/:userId
 * Public trust profile for a user.
 */
router.get('/public/:userId', writeLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true, trustScore: true, reliabilityScore: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const passport = await prisma.trustPassport.findFirst({ where: { userId } });

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: `${user.firstName} ${user.lastName}`.trim(),
          email: user.email,
          trustScore: user.trustScore,
          reliabilityScore: user.reliabilityScore,
        },
        passport: passport
          ? {
              id: passport.id,
              handle: passport.handle,
              displayName: passport.displayName,
              category: passport.category,
              scores: publicScores(passport),
              claimsCount: passport.claimsCount,
              verifiedIdentity: passport.verifiedIdentity,
            }
          : null,
      },
    });
  } catch (error: any) {
    logger.error(`[Trust] public error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/trust/:passportId/attestations
 * List onchain attestations for a passport.
 */
router.get('/:passportId/attestations', apiLimiter, async (req: Request, res: Response) => {
  try {
    const passportId = req.params.passportId;
    if (!passportId) {
      return res.status(400).json({ success: false, error: 'passportId is required' });
    }

    const passport = await prisma.trustPassport.findUnique({ where: { id: passportId } });
    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Passport not found or private' });
    }

    const attestations = await getAttestationsForPassport(passportId);

    return res.json({
      success: true,
      data: {
        passportId,
        count: attestations.length,
        attestations: attestations.map(a => ({
          eventType: a.eventType,
          referenceId: a.referenceId,
          txSignature: a.txSignature,
          explorerUrl: a.explorerUrl,
          createdAt: a.createdAt,
        })),
      },
    });
  } catch (error: any) {
    logger.error(`[Trust] attestations error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/trust/:passportId/attestations/export
 * Export attestations as JSON download.
 */
router.get('/:passportId/attestations/export', apiLimiter, async (req: Request, res: Response) => {
  try {
    const passportId = req.params.passportId;
    if (!passportId) {
      return res.status(400).json({ success: false, error: 'passportId is required' });
    }

    const passport = await prisma.trustPassport.findUnique({ where: { id: passportId } });
    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Passport not found or private' });
    }

    const attestations = await getAttestationsForPassport(passportId);

    const exportData = {
      passportId,
      handle: passport.handle,
      displayName: passport.displayName,
      exportedAt: new Date().toISOString(),
      attestations: attestations.map(a => ({
        eventType: a.eventType,
        referenceId: a.referenceId,
        txSignature: a.txSignature,
        explorerUrl: a.explorerUrl,
        createdAt: a.createdAt,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=attestations-${passport.handle || passportId}.json`);
    res.send(JSON.stringify(exportData, null, 2));
  } catch (error: any) {
    logger.error(`[Trust] export error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
