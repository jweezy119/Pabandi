import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AuthRequest } from '../middleware/auth.middleware';
import { serviceProviderIngestion, type ExternalProviderProfile } from '../services/serviceProviderIngestion.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { bestFitEngineService } from '../services/ai/bestFitEngine.service';
import { x402Pay } from '../middleware/x402Pay.middleware';
import { X402_PRICING } from '../config/fees';

const router = Router();

/**
 * POST /api/v1/service-providers/ingest
 * Ingest a single external service provider profile into Pabandi.
 * Creates TrustPassport + SocialIdentity + PTP attestation.
 * Body: ExternalProviderProfile
 */
router.post('/ingest', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const profile: ExternalProviderProfile = req.body;
    if (!profile.source || !profile.sourceId || !profile.name) {
      return res.status(400).json({
        success: false,
        error: 'source, sourceId, and name are required',
      });
    }

    const result = await serviceProviderIngestion.ingestProvider(profile);

    res.json({
      success: true,
      data: {
        passportId: result.passportId,
        handle: result.handle,
        displayName: result.displayName,
        trustScore: result.trustScore,
        riskBand: result.riskBand,
        category: result.category,
        skills: result.skills,
        source: result.source,
        sourceId: result.sourceId,
        attestation: result.attestation,
      },
      message: `Provider ingested with trust score ${result.trustScore} (band ${result.riskBand})`,
    });
  } catch (error: any) {
    logger.error('[ServiceProviderRoutes] Ingest error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/service-providers/ingest/batch
 * Ingest multiple providers at once.
 * Body: { profiles: ExternalProviderProfile[] }
 */
router.post('/ingest/batch', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { profiles }: { profiles: ExternalProviderProfile[] } = req.body;
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(400).json({ success: false, error: 'profiles array required' });
    }

    const result = await serviceProviderIngestion.ingestProviders(profiles);

    res.json({
      success: true,
      data: {
        ingested: result.ingested.map((p) => ({
          passportId: p.passportId,
          handle: p.handle,
          displayName: p.displayName,
          trustScore: p.trustScore,
          riskBand: p.riskBand,
          source: p.source,
          sourceId: p.sourceId,
        })),
        errors: result.errors,
        totalIngested: result.ingested.length,
        totalErrors: result.errors.length,
      },
      message: `Ingested ${result.ingested.length} providers (${result.errors.length} errors)`,
    });
  } catch (error: any) {
    logger.error('[ServiceProviderRoutes] Batch ingest error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/service-providers/discover
 * Discover providers for AI agent booking.
 * Query: minTrustScore, category, skills (comma-separated), limit, offset
 */
router.get('/discover', async (req: Request, res: Response) => {
  try {
    const skillsParam = req.query.skills as string | undefined;
    const result = await serviceProviderIngestion.discoverProviders({
      minTrustScore: req.query.minTrustScore ? Number(req.query.minTrustScore) : undefined,
      category: req.query.category as string | undefined,
      skills: skillsParam ? skillsParam.split(',').map(s => s.trim()).filter(Boolean) : [],
      limit: req.query.limit ? Number(req.query.limit) : 20,
      offset: req.query.offset ? Number(req.query.offset) : 0,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[ServiceProviderRoutes] Discover error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/v1/service-providers/:passportId
 * Get a single provider's public profile.
 */
router.get('/:passportId', async (req: Request, res: Response) => {
  try {
    const passport = await prisma.trustPassport.findUnique({
      where: { id: req.params.passportId },
    });
    if (!passport) {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }
    if (passport.visibility !== 'PUBLIC') {
      return res.status(404).json({ success: false, error: 'Provider not found' });
    }

    res.json({
      success: true,
      data: {
        id: passport.id,
        handle: passport.handle,
        displayName: passport.displayName,
        category: passport.category,
        bio: passport.bio,
        headline: passport.headline,
        location: passport.location,
        websiteUrl: passport.websiteUrl,
        avatarUrl: passport.avatarUrl,
        skills: passport.skills || [],
        trustScore: passport.riskScore,
        riskBand: passport.riskBand,
        verified: passport.verified,
        socialLinks: passport.socialLinks,
        portfolioItems: passport.portfolioItems,
        createdAt: passport.createdAt,
        lastCheckedAt: passport.lastCheckedAt,
      },
    });
  } catch (error: any) {
    logger.error('[ServiceProviderRoutes] Get provider error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/v1/service-providers/book
 * AI agent books a service provider via escrow.
 * Body: { passportId, amount, description, scheduledDate, skills }
 * Creates escrow + records gig outcome for BestFitEngine tracking.
 */
router.post(
  '/book',
  authenticate,
  x402Pay({ amount: 0.50, resource: '/api/v1/service-providers/book', description: 'Agent booking fee' }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { passportId, amount, description, scheduledDate, skills } = req.body;
      const agentId = req.user!.id;

      if (!passportId || !amount || amount <= 0) {
        return res.status(400).json({ success: false, error: 'passportId and positive amount required' });
      }

      const passport = await prisma.trustPassport.findUnique({
        where: { id: passportId },
      });
      if (!passport) {
        return res.status(404).json({ success: false, error: 'Provider not found' });
      }

      // ── Create escrow for the booking ──
      const referenceId = `booking-${cryptoRandomId()}`;
      const escrow = await prisma.universalEscrow.create({
        data: {
          referenceId,
          template: 'service-booking',
          parties: [
            { partyId: agentId, role: 'buyer' },
            { partyId: passportId, role: 'provider' },
          ],
          amount,
          currency: 'USDC',
          conditions: [
            { type: 'delivery', verify: { expectedHash: null } },
            { type: 'timeout', verify: { deadline: scheduledDate ? new Date(scheduledDate).toISOString() : null } },
          ],
          metadata: {
            providerPassportId: passportId,
            providerHandle: passport.handle,
            providerDisplayName: passport.displayName,
            agentId,
            description,
            skills,
            bookingType: 'service_provider',
          },
          status: 'draft',
          deadline: scheduledDate ? new Date(scheduledDate) : null,
        },
      });

      // ── Record gig outcome placeholder for BestFitEngine ──
      await (prisma as any).passportGigHistory.create({
        data: {
          passportId,
          gigId: referenceId,
          title: description || 'Service booking',
          description,
          scheduledDate: scheduledDate ? new Date(scheduledDate) : new Date(),
          status: 'COMPLETED',
        },
      });

      logger.info(
        `[ServiceProviderRoutes] Agent ${agentId} booked provider ${passportId} for $${amount} (escrow ${referenceId})`
      );

      res.json({
        success: true,
        data: {
          referenceId,
          escrowId: escrow.id,
          amount,
          currency: 'USDC',
          provider: {
            id: passport.id,
            handle: passport.handle,
            displayName: passport.displayName,
            trustScore: passport.riskScore,
            riskBand: passport.riskBand,
          },
          agentId,
          platformFeeRate: 0.035,
          instructions: {
            step1: 'Fund escrow with USDC',
            step2: 'Provider delivers service',
            step3: 'Verify completion to release funds',
          },
        },
      });
    } catch (error: any) {
      logger.error('[ServiceProviderRoutes] Book error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/v1/service-providers/gig-outcome
 * Record the outcome of a completed gig for BestFitEngine tracking.
 * Body: { passportId, gigId, status, clientRating, leadTimeHours }
 */
router.post('/gig-outcome', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { passportId, gigId, status, clientRating, leadTimeHours } = req.body;

    if (!passportId || !gigId || !status) {
      return res.status(400).json({ success: false, error: 'passportId, gigId, and status required' });
    }

    await bestFitEngineService.ingestGigOutcome({
      passportId,
      gigId,
      title: 'Service booking',
      scheduledDate: new Date(),
      status: status as 'COMPLETED' | 'CANCELLED' | 'NO_SHOW',
      clientRating: clientRating || undefined,
      leadTimeHours: leadTimeHours || undefined,
    });

    res.json({
      success: true,
      data: { passportId, gigId, status },
    });
  } catch (error: any) {
    logger.error('[ServiceProviderRoutes] Gig outcome error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function cryptoRandomId(): string {
  return require('crypto').randomBytes(8).toString('hex');
}

export default router;
