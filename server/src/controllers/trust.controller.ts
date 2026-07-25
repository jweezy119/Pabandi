import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/database';
import { trustAttestationService } from '../services/trustAttestation.service';
import { trustScoreService } from '../services/trustScore.service';
import { trustAuditWriter } from '../services/trustAuditWriter';
import { trustSignalService } from '../services/trustSignal.service';
import type { AuthRequest } from '../middleware/auth.middleware';

const ATTEMPT_REASON_MAP: Record<string, string> = {
  BOOKING: 'booking.access.check',
  REVIEW: 'review.access.check',
  AIRDROP_CLAIM: 'airdrop.access.check',
  REFERRAL_ACTIVATE: 'referral.access.check',
  TAP_PAY_CHECKOUT: 'tap_pay.access.check',
  WAITLIST_JOIN: 'waitlist.access.check',
};

const REQUIREMENTS: Record<string, { score: number; reasons: string[] }> = {
  BOOKING: { score: 20, reasons: ['account_age', 'booking_history'] },
  REVIEW: { score: 25, reasons: ['account_age', 'booking_history'] },
  AIRDROP_CLAIM: { score: 30, reasons: ['verification', 'platform_stake'] },
  REFERRAL_ACTIVATE: { score: 20, reasons: ['account_age'] },
  TAP_PAY_CHECKOUT: { score: 40, reasons: ['payment_history', 'wallet_connected'] },
  WAITLIST_JOIN: { score: 15, reasons: ['account_age'] },
};

function resolveCurrentUser(req: AuthRequest) {
  if (!req.user?.id) {
    return null;
  }

  return req.user;
}

function mapTierToUI(score: number) {
  if (score >= 80) return 'PLATINUM';
  if (score >= 60) return 'GOLD';
  if (score >= 40) return 'SILVER';
  return 'BRONZE';
}

export const getMyTrustProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required for trust profile.' });
    }

    const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!fullUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const attestation = await trustAttestationService.issue(user.id);
    const velocity = await trustScoreService.computeVelocity(user.id);

    res.json({
      success: true,
      data: {
        score: fullUser.trustScore,
        tier: fullUser.verificationTier,
        uiTier: mapTierToUI(fullUser.trustScore),
        methodology: '1.0.0',
        attestation,
        trustVelocity: velocity,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyTrustAuditTimeline = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const audits = await prisma.trustAuditTrail.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        createdAt: true,
        changeReason: true,
        previousScore: true,
        newScore: true,
        severity: true,
        component: true,
      },
    });

    const timeline = audits.map((a) => ({
      date: a.createdAt,
      pointsDelta: Math.round((a.newScore - a.previousScore) * 10) / 10,
      reason: a.changeReason,
      severity: a.severity,
      component: a.component,
      previousScore: a.previousScore,
      newScore: a.newScore,
    }));

    res.json({ success: true, data: timeline });
  } catch (error) {
    next(error);
  }
};

export const getActionRequirements = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const action = req.params.action;
    const requirement = REQUIREMENTS[action];

    if (!requirement) {
      return res.status(404).json({ success: false, message: `Unknown trust action: ${action}` });
    }

    res.json({
      success: true,
      data: {
        action,
        requiredScore: requirement.score,
        requiredStamps: requirement.reasons,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const checkMyActionAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const action = req.params.action;
    const requirement = REQUIREMENTS[action];

    if (!requirement) {
      return res.status(404).json({ success: false, message: `Unknown trust action: ${action}` });
    }

    const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!fullUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const score = fullUser.trustScore;
    const reasonKey = ATTEMPT_REASON_MAP[action] || `${action}.access.check`;

    if (score < requirement.score) {
      await trustScoreService.processEvent(user.id, {
        component: 'trust_api',
        reason: reasonKey,
        severity: 'neutral',
      }).catch(() => undefined);

      return res.json({
        success: true,
        data: {
          allowed: false,
          action,
          score,
          requiredScore: requirement.score,
          missingStamps: requirement.reasons,
          reason: `Minimum trust score ${requirement.score} is required for ${action}.`,
        },
      });
    }

    res.json({
      success: true,
      data: {
        allowed: true,
        action,
        score,
        requiredScore: requirement.score,
        missingStamps: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMyTrustStamps = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const [reservations, wallet, businesses] = await Promise.all([
      prisma.reservation.count({ where: { customerId: user.id, status: 'COMPLETED' as any } }),
      prisma.wallet.findFirst({ where: { userId: user.id } }),
      prisma.business.count({ where: { ownerId: user.id } }),
    ]);

    const stamps = [
      {
        id: `local::booking_history::${user.id}`,
        userId: user.id,
        stampType: 'BOOKING_HISTORY',
        weight: Math.min(reservations * 2, 20),
        issuer: 'pabandi',
        context: `${reservations} completed bookings`,
        attestationHash: `local:booking:${user.id}`,
        revoked: false,
        issuedAt: new Date().toISOString(),
        effectiveWeight: Math.min(reservations * 2, 20),
        isTrusted: reservations > 0,
        isExpired: false,
      },
      {
        id: `local::wallet::${user.id}`,
        userId: user.id,
        stampType: 'WALLET_CONNECTED',
        weight: 5,
        issuer: 'pabandi',
        context: wallet ? 'linked wallet' : 'no linked wallet',
        attestationHash: `local:wallet:${user.id}`,
        revoked: false,
        issuedAt: new Date().toISOString(),
        effectiveWeight: wallet ? 5 : 0,
        isTrusted: Boolean(wallet),
        isExpired: false,
      },
    ];

    if (businesses > 0) {
      stamps.push({
        id: `local::business::${user.id}`,
        userId: user.id,
        stampType: 'BUSINESS_PROFILE_COMPLETE',
        weight: 10,
        issuer: 'pabandi',
        context: `${businesses} business profile`,
        attestationHash: `local:business:${user.id}`,
        revoked: false,
        issuedAt: new Date().toISOString(),
        effectiveWeight: 10,
        isTrusted: true,
        isExpired: false,
      });
    }

    res.json({ success: true, data: stamps });
  } catch (error) {
    next(error);
  }
};

export const createMyTrustStamp = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = resolveCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const stampType = req.body?.stampType;
    const context = req.body?.context;

    if (!stampType) {
      return res.status(400).json({ success: false, message: 'stampType is required' });
    }

    await trustAuditWriter.enqueue({
      userId: user.id,
      previousScore: 0,
      newScore: 0,
      changeReason: `trust.stamp.issued:${stampType}`,
      component: 'trust_stamps',
      severity: 'positive',
      weightUsed: 0,
      methodology: '1.0.0',
      metadata: { context, origin: 'api', issuedAt: new Date().toISOString() },
    });

    const stamp = {
      id: `stub::${stampType}::${user.id}::${Date.now()}`,
      userId: user.id,
      stampType,
      weight: 1,
      issuer: 'client',
      context: context || 'manual issuance',
      attestationHash: `stub:${stampType}:${user.id}`,
      revoked: false,
      issuedAt: new Date().toISOString(),
      effectiveWeight: 1,
      isTrusted: false,
      isExpired: false,
    };

    res.status(201).json({ success: true, data: stamp });
  } catch (error) {
    next(error);
  }
};

export const recordGuestEscrowEvent = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const payload = req.body as { eventType?: string };

    if (!payload?.eventType) {
      return res.status(400).json({ success: false, message: 'eventType is required' });
    }

    const weight = payload.eventType === 'DISPUTE_LOST' ? -15 : payload.eventType === 'APPOINTMENT_HONORED' ? 5 : 0;

    if (weight !== 0) {
      await trustAuditWriter.enqueue({
        userId: (req.user?.id as string) || 'guest',
        previousScore: 0,
        newScore: weight,
        changeReason: `guest.escrow.event:${payload.eventType}`,
        component: 'guest_escrow',
        severity: weight > 0 ? 'positive' : 'negative',
        weightUsed: weight,
        methodology: '1.0.0',
        metadata: payload,
      }).catch(() => undefined);
    }

    res.json({ success: true, recorded: true, eventType: payload.eventType });
  } catch (error) {
    next(error);
  }
};
