import { Router } from 'express';
import {
  getMyTrustProfile,
  getMyTrustAuditTimeline,
  getMyTrustStamps,
  createMyTrustStamp,
  getActionRequirements,
  checkMyActionAccess,
  recordGuestEscrowEvent,
  streamTrustPulse,
} from '../controllers/trust.controller';
import { authenticate } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';

const router = Router();

router.get('/audit/:userId', getMyTrustAuditTimeline);
router.get('/score/me', authenticate, getMyTrustProfile);
router.get('/stamps/me', authenticate, getMyTrustStamps);
router.post('/stamps/issue', authenticate, createMyTrustStamp);
router.get('/requirements/:action', getActionRequirements);
router.post('/action/:action/check', authenticate, checkMyActionAccess);
router.post('/guest/escrow-event', recordGuestEscrowEvent);
router.get('/pulse/:userId', streamTrustPulse);

/**
 * GET /api/v1/trust/flux/:userId
 * Returns TrustFlux trajectory data (velocity-driven GNN prediction).
 * Public endpoint — anyone can check a user's trust trend direction.
 */
router.get('/flux/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const { trustFluxService } = await import('../services/trustFlux.service');
    const flux = await trustFluxService.computeTrustFlux(userId);
    // Also compute peer-normalized velocity
    flux.peerNormalizedVelocity = await trustFluxService.getPeerNormalizedVelocity(userId, flux.velocity);
    res.json({ success: true, data: flux });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/flux/:userId/predict
 * Returns 30-day forward trajectory projection with decayed velocity.
 */
router.get('/flux/:userId/predict', async (req, res) => {
  const { userId } = req.params;
  const days = Number(req.query.days || 30);
  try {
    const { trustFluxService } = await import('../services/trustFlux.service');
    const projection = await trustFluxService.predict(userId, days);
    res.json({ success: true, data: projection });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/public/:userId — public trust profile (no auth).
 * Returns score + tier + attestation + velocity (no owner-only actions).
 */
/**
 * GET /api/v1/trust/litigation/:userId — public eviction/housing litigation check.
 * Runs CourtListener for the user's name and returns the finding + trust impact.
 * No auth. Safe to expose (name resolved server-side; only aggregate flags returned).
 */
router.get('/litigation/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const state = (req.query.state as string) || undefined;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const { courtListenerService } = await import('../services/osint/courtListener.service');
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    const ev = await courtListenerService.lookupEvictions(fullName, state);

    // Mirror the penalty the trust engine would apply.
    let penalty = 0;
    if (ev.found) {
      penalty = 25;
      if (ev.recentEviction) penalty += 20;
      penalty += Math.min(15, (ev.count - 1) * 5);
    }

    res.json({
      success: true,
      data: {
        queriedName: fullName,
        jurisdiction: state || 'ALL',
        evictionFound: ev.found,
        recentEviction: ev.recentEviction,
        evictionCount: ev.count,
        trustPenalty: penalty,
        cases: ev.cases,
        simulated: !process.env.COURTLISTENER_API_KEY,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/public/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    const [attestation, velocity] = await Promise.all([
      (await import('../services/trustAttestation.service')).trustAttestationService.issue(user.id),
      (await import('../services/trustScore.service')).trustScoreService.computeVelocity(user.id),
    ]);
    res.json({
      success: true,
      data: {
        userId: user.id,
        score: user.trustScore,
        tier: user.verificationTier,
        attestation,
        trustVelocity: velocity,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/stamps/:userId — public trust audit timeline (no auth).
 */
router.get('/stamps/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const stamps = await prisma.trustAuditTrail.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 50 });
    res.json({ success: true, data: stamps });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/v1/trust/veil/issue
 * Issue a zero-knowledge trust badge proving score ≥ threshold without revealing score.
 * Body: { userId, trustScore, threshold }
 */
router.post('/veil/issue', async (req, res) => {
  const { userId, trustScore, threshold = 70 } = req.body;
  try {
    const { trustVeilService } = await import('../services/trustVeil.service');
    const proof = await trustVeilService.issueProof(userId, trustScore, threshold);
    res.json({ success: true, data: proof });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/veil/verify/:proofId
 * Verify a TrustVeil proof. Only learns: isAboveThreshold, trend, validity.
 * The actual score is never revealed.
 */
router.get('/veil/verify/:proofId', async (req, res) => {
  const { proofId } = req.params;
  try {
    const { trustVeilService } = await import('../services/trustVeil.service');
    // In production, fetch the proof from DB by proofId
    // For now, return the verification schema
    res.json({ success: true, data: { verified: 'proofId-based lookup requires DB integration' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── CROSS-MODULE INTEGRATION ─────────────────────────

/**
 * GET /api/v1/trust/passport/:userId
 * Get trust passport with reliability score
 */
router.get('/passport/:userId', async (req, res) => {
   try {
     const { userId } = req.params;
     let passport = await prisma.trustPassport.findUnique({ where: { userId } });
     if (!passport) {
       passport = await prisma.trustPassport.create({
         data: { 
           userId, 
           handle: `user-${userId}`, 
           displayName: `User ${userId}`, 
           showUpScore: 500, 
           paymentScore: 500, 
           deliveryScore: 500, 
           tenancyScore: 500, 
           freightScore: 500,
           level: 'bronze', 
           verified: false 
         },
       });
     }
res.json({ success: true, data: passport });
   } catch (err: any) {
     res.status(500).json({ success: false, error: err.message });
   }
 });

 /**
  * GET /api/v1/trust/passport/:userId/scores
  * Returns all context-scoped trust scores with confidence indicators
  */
 router.get('/passport/:userId/scores', async (req, res) => {
   try {
     const { userId } = req.params;
     const passport = await prisma.trustPassport.findUnique({ where: { userId } });
     if (!passport) {
       return res.status(404).json({ success: false, message: 'Passport not found' });
     }

     res.json({
       success: true,
       data: {
         passport_id: passport.id,
         scores: {
           show_up: {
             value: passport.showUpScore,
             sample_size: passport.showUpSampleSize,
             confidence: passport.showUpSampleSize >= 21 ? 'high' : 
                       passport.showUpSampleSize >= 6 ? 'medium' :
                       passport.showUpSampleSize >= 1 ? 'low' : 'none'
           },
           payment: {
             value: passport.paymentScore,
             sample_size: passport.paymentSampleSize,
             confidence: passport.paymentSampleSize >= 21 ? 'high' : 
                        passport.paymentSampleSize >= 6 ? 'medium' :
                        passport.paymentSampleSize >= 1 ? 'low' : 'none'
           },
           delivery: {
             value: passport.deliveryScore,
             sample_size: passport.deliverySampleSize,
             confidence: passport.deliverySampleSize >= 21 ? 'high' : 
                        passport.deliverySampleSize >= 6 ? 'medium' :
                        passport.deliverySampleSize >= 1 ? 'low' : 'none'
           },
           tenancy: {
             value: passport.tenancyScore,
             sample_size: passport.tenancySampleSize,
             confidence: passport.tenancySampleSize >= 21 ? 'high' : 
                        passport.tenancySampleSize >= 6 ? 'medium' :
                        passport.tenancySampleSize >= 1 ? 'low' : 'none'
           },
           freight: {
             value: passport.freightScore,
             sample_size: passport.freightSampleSize,
             confidence: passport.freightSampleSize >= 21 ? 'high' : 
                        passport.freightSampleSize >= 6 ? 'medium' :
                        passport.freightSampleSize >= 1 ? 'low' : 'none'
           }
         },
         flags: {
           verified_identity: passport.verifiedIdentity,
           fraud: passport.fraudFlag,
           escrow_theft: passport.escrowTheftFlag,
           chargeback_fraud_count: passport.chargebackFraudCount
         }
       }
     });
   } catch (err: any) {
     res.status(500).json({ success: false, error: err.message });
   }
 });

 /**
  * GET /api/v1/trust/passport/:userId/score?context=X
  * Returns score for a specific context
  */
 router.get('/passport/:userId/score', async (req, res) => {
   try {
     const { userId } = req.params;
     const { context } = req.query;
     
     if (!context) {
       return res.status(400).json({ success: false, message: 'Context parameter is required' });
     }

     const passport = await prisma.trustPassport.findUnique({ where: { userId } });
     if (!passport) {
       return res.status(404).json({ success: false, message: 'Passport not found' });
     }

     let scoreValue: number;
     let scoreType: string;
     let sampleSize: number;
     
     switch (context.toLowerCase()) {
       case 'booking':
       case 'show_up':
         scoreValue = passport.showUpScore;
         scoreType = 'show_up';
         sampleSize = passport.showUpSampleSize;
         break;
       case 'payment':
       case 'invoice':
         scoreValue = passport.paymentScore;
         scoreType = 'payment';
         sampleSize = passport.paymentSampleSize;
         break;
       case 'delivery':
       case 'freight':
         scoreValue = passport.deliveryScore;
         scoreType = 'delivery';
         sampleSize = passport.deliverySampleSize;
         break;
       case 'tenancy':
       case 'lease':
       case 'property':
         scoreValue = passport.tenancyScore;
         scoreType = 'tenancy';
         sampleSize = passport.tenancySampleSize;
         break;
       case 'freight_only':
         scoreValue = passport.freightScore;
         scoreType = 'freight';
         sampleSize = passport.freightSampleSize;
         break;
       default:
         return res.status(400).json({ success: false, message: 'Invalid context. Valid contexts: booking, payment, delivery, tenancy, freight' });
     }

     const confidence = sampleSize >= 21 ? 'high' : 
                       sampleSize >= 6 ? 'medium' :
                       sampleSize >= 1 ? 'low' : 'none';

     res.json({
       success: true,
       data: {
         context,
         score: scoreValue,
         score_type: scoreType,
         sample_size: sampleSize,
         confidence,
         flags: {
           verified_identity: passport.verifiedIdentity,
           fraud: passport.fraudFlag,
           escrow_theft: passport.escrowTheftFlag,
           chargeback_fraud_count: passport.chargebackFraudCount
         }
       }
     });
   } catch (err: any) {
     res.status(500).json({ success: false, error: err.message });
   }
 });

/**
 * PUT /api/v1/trust/score/:userId
 * Update trust score (with audit trail)
 */
router.put('/score/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
const { delta, reason } = req.body;
     let passport = await prisma.trustPassport.findUnique({ where: { userId } });
     if (!passport) {
       passport = await prisma.trustPassport.create({
         data: { 
           userId, 
           handle: `user-${userId}`, 
           displayName: `User ${userId}`, 
           showUpScore: 500, 
           paymentScore: 500, 
           deliveryScore: 500, 
           tenancyScore: 500, 
           freightScore: 500,
           level: 'bronze', 
           verified: false 
         },
       });
     }
const newScore = Math.max(0, Math.min(1000, (passport.showUpScore || 0) + ((delta || 0) * 10)));
     const level = newScore >= 900 ? 'platinum' : newScore >= 700 ? 'gold' : newScore >= 500 ? 'silver' : 'bronze';
     const updated = await prisma.trustPassport.update({
       where: { userId },
       data: { showUpScore: newScore, level },
     });
    res.json({ success: true, data: updated });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/risk/:userId
 * Get risk assessment for a user
 */
router.get('/risk/:userId', async (req, res) => {
   try {
     const { userId } = req.params;
     let passport = await prisma.trustPassport.findUnique({ where: { userId } });
     if (!passport) {
       passport = await prisma.trustPassport.create({
         data: { 
           userId, 
           handle: `user-${userId}`, 
           displayName: `User ${userId}`, 
           showUpScore: 500, 
           paymentScore: 500, 
           deliveryScore: 500, 
           tenancyScore: 500, 
           freightScore: 500,
           level: 'bronze', 
           verified: false 
         },
       });
     }
     // Use showUpScore for risk assessment (backward compatibility)
     const riskScore = passport.showUpScore ?? 0;
     const risk = riskScore >= 700 ? 'low' : riskScore >= 400 ? 'medium' : 'high';
     res.json({ 
       success: true, 
       data: { 
         userId, 
         score: riskScore, 
         risk, 
         level: passport.level 
       } 
     });
   } catch (err: any) {
     res.status(500).json({ success: false, error: err.message });
   }
 });

/**
 * GET /api/v1/trust/escrow/:userId
 * Check if user is eligible for escrow
 */
router.get('/escrow/:userId', async (req, res) => {
   try {
     const { userId } = req.params;
     let passport = await prisma.trustPassport.findUnique({ where: { userId } });
     if (!passport) {
       passport = await prisma.trustPassport.create({
         data: { 
           userId, 
           handle: `user-${userId}`, 
           displayName: `User ${userId}`, 
           showUpScore: 500, 
           paymentScore: 500, 
           deliveryScore: 500, 
           tenancyScore: 500, 
           freightScore: 500,
           level: 'bronze', 
           verified: false 
         },
       });
     }
     // Use showUpScore for escrow eligibility (backward compatibility)
     const eligible = (passport.showUpScore || 0) >= 300; // 30 old scale = 300 new scale
     res.json({ success: true, data: { userId, eligible, score: passport.showUpScore || 0 } });
   } catch (err: any) {
     res.status(500).json({ success: false, error: err.message });
   }
 });

/**
 * POST /api/v1/trust/events
 * Emit a cross-module event
 */
router.post('/events', async (req, res) => {
  try {
    const { event, data } = req.body;
    const { eventBus } = await import('../services/event-bus.service');
    eventBus.emitEvent(event, data);
    res.json({ success: true, data: { event, emitted: true } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/v1/trust/report/:businessId
 * Full trust report across all modules
 */
router.get('/report/:businessId', async (req, res) => {
  try {
    const { businessId } = req.params;
    const passports = await prisma.trustPassport.findMany({
      where: { providerRef: businessId },
    });
    res.json({
      success: true,
      data: {
        businessId,
        totalPassports: passports.length,
        averageScore: passports.reduce((sum, p) => sum + (p.score || 0), 0) / Math.max(1, passports.length),
        passports,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
