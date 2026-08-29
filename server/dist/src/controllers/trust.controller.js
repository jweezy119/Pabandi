"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.streamTrustPulse = exports.recordGuestEscrowEvent = exports.createMyTrustStamp = exports.getMyTrustStamps = exports.checkMyActionAccess = exports.getActionRequirements = exports.getMyTrustAuditTimeline = exports.getMyTrustProfile = void 0;
const database_1 = require("../utils/database");
const trustAttestation_service_1 = require("../services/trustAttestation.service");
const trustScore_service_1 = require("../services/trustScore.service");
const trustAuditWriter_1 = require("../services/trustAuditWriter");
const apiResponse_1 = require("../utils/apiResponse");
const ATTEMPT_REASON_MAP = {
    BOOKING: 'booking.access.check',
    REVIEW: 'review.access.check',
    AIRDROP_CLAIM: 'airdrop.access.check',
    REFERRAL_ACTIVATE: 'referral.access.check',
    TAP_PAY_CHECKOUT: 'tap_pay.access.check',
    WAITLIST_JOIN: 'waitlist.access.check',
};
const REQUIREMENTS = {
    BOOKING: { score: 20, reasons: ['account_age', 'booking_history'] },
    REVIEW: { score: 25, reasons: ['account_age', 'booking_history'] },
    AIRDROP_CLAIM: { score: 30, reasons: ['verification', 'platform_stake'] },
    REFERRAL_ACTIVATE: { score: 20, reasons: ['account_age'] },
    TAP_PAY_CHECKOUT: { score: 40, reasons: ['payment_history', 'wallet_connected'] },
    WAITLIST_JOIN: { score: 15, reasons: ['account_age'] },
};
function resolveCurrentUser(req) {
    if (!req.user?.id) {
        return null;
    }
    return req.user;
}
function mapTierToUI(score) {
    if (score >= 80)
        return 'PLATINUM';
    if (score >= 60)
        return 'GOLD';
    if (score >= 40)
        return 'SILVER';
    return 'BRONZE';
}
const getMyTrustProfile = async (req, res, next) => {
    try {
        const user = resolveCurrentUser(req);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required for trust profile.' });
        }
        const fullUser = await database_1.prisma.user.findUnique({ where: { id: user.id } });
        if (!fullUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const attestation = await trustAttestation_service_1.trustAttestationService.issue(user.id);
        const velocity = await trustScore_service_1.trustScoreService.computeVelocity(user.id);
        const payload = {
            success: true,
            data: {
                score: fullUser.trustScore,
                tier: fullUser.verificationTier,
                uiTier: mapTierToUI(fullUser.trustScore),
                methodology: '1.0.0',
                attestation,
                trustVelocity: velocity,
            },
        };
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
};
exports.getMyTrustProfile = getMyTrustProfile;
const getMyTrustAuditTimeline = async (req, res, next) => {
    try {
        const user = resolveCurrentUser(req);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const limit = parseInt(req.query.limit) || 20;
        const audits = await database_1.prisma.trustAuditTrail.findMany({
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
            date: a.createdAt.toISOString(),
            pointsDelta: Math.round((a.newScore - a.previousScore) * 10) / 10,
            reason: a.changeReason,
            severity: a.severity,
            component: a.component,
            previousScore: a.previousScore,
            newScore: a.newScore,
        }));
        res.json({ success: true, data: timeline });
    }
    catch (error) {
        next(error);
    }
};
exports.getMyTrustAuditTimeline = getMyTrustAuditTimeline;
const getActionRequirements = async (req, res, next) => {
    try {
        const action = req.params.action;
        const requirement = REQUIREMENTS[action];
        if (!requirement) {
            return res.status(404).json({ success: false, message: `Unknown trust action: ${action}` });
        }
        const payload = {
            success: true,
            data: {
                action,
                requiredScore: requirement.score,
                requiredStamps: requirement.reasons,
            },
        };
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
};
exports.getActionRequirements = getActionRequirements;
const checkMyActionAccess = async (req, res, next) => {
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
        const fullUser = await database_1.prisma.user.findUnique({ where: { id: user.id } });
        if (!fullUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const score = fullUser.trustScore;
        const reasonKey = ATTEMPT_REASON_MAP[action] || `${action}.access.check`;
        if (score < requirement.score) {
            await trustScore_service_1.trustScoreService.processEvent(user.id, {
                component: 'trust_api',
                reason: reasonKey,
                severity: 'neutral',
            }).catch(() => undefined);
            const payload = {
                success: true,
                data: {
                    allowed: false,
                    action,
                    score,
                    requiredScore: requirement.score,
                    missingStamps: requirement.reasons,
                    reason: `Minimum trust score ${requirement.score} is required for ${action}.`,
                },
            };
            return res.json(payload);
        }
        const payload = {
            success: true,
            data: {
                allowed: true,
                action,
                score,
                requiredScore: requirement.score,
                missingStamps: [],
            },
        };
        res.json(payload);
    }
    catch (error) {
        next(error);
    }
};
exports.checkMyActionAccess = checkMyActionAccess;
const getMyTrustStamps = async (req, res, next) => {
    try {
        const user = resolveCurrentUser(req);
        if (!user) {
            return res.status(401).json({ success: false, message: 'Authentication required.' });
        }
        const [reservations, wallet, businesses] = await Promise.all([
            database_1.prisma.reservation.count({ where: { customerId: user.id, status: 'COMPLETED' } }),
            database_1.prisma.wallet.findFirst({ where: { userId: user.id } }),
            database_1.prisma.business.count({ where: { ownerId: user.id } }),
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
    }
    catch (error) {
        next(error);
    }
};
exports.getMyTrustStamps = getMyTrustStamps;
const createMyTrustStamp = async (req, res, next) => {
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
        await trustAuditWriter_1.trustAuditWriter.enqueue({
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
    }
    catch (error) {
        next(error);
    }
};
exports.createMyTrustStamp = createMyTrustStamp;
const recordGuestEscrowEvent = async (req, res, next) => {
    try {
        const { eventType } = req.body ?? {};
        if (!eventType) {
            return (0, apiResponse_1.fail)(res, 'eventType is required', 400);
        }
        const weight = eventType === 'DISPUTE_LOST' ? -15 : eventType === 'APPOINTMENT_HONORED' ? 5 : 0;
        if (weight !== 0) {
            await trustAuditWriter_1.trustAuditWriter.enqueue({
                userId: req.user?.id || 'guest',
                previousScore: 0,
                newScore: weight,
                changeReason: `guest.escrow.event:${eventType}`,
                component: 'guest_escrow',
                severity: weight > 0 ? 'positive' : 'negative',
                weightUsed: weight,
                methodology: '1.0.0',
                metadata: { eventType },
            }).catch(() => undefined);
        }
        return (0, apiResponse_1.ok)(res, {
            success: true,
            recorded: true,
            eventType,
        });
    }
    catch (error) {
        next(error);
    }
};
exports.recordGuestEscrowEvent = recordGuestEscrowEvent;
const streamTrustPulse = (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    const sendPulse = async () => {
        try {
            const velocity = await trustScore_service_1.trustScoreService.computeVelocity(userId);
            const user = await database_1.prisma.user.findUnique({
                where: { id: userId },
                select: { trustScore: true, verificationTier: true },
            });
            const payload = {
                userId,
                score: user?.trustScore ?? 0,
                tier: user?.verificationTier ?? 'BASIC',
                velocity,
                timestamp: new Date().toISOString(),
            };
            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }
        catch (error) {
            res.write(`event: error\ndata: ${JSON.stringify({ message: 'Failed to compute trust pulse' })}\n\n`);
        }
    };
    sendPulse();
    const interval = setInterval(sendPulse, 30000);
    req.on('close', () => {
        clearInterval(interval);
        res.end();
    });
};
exports.streamTrustPulse = streamTrustPulse;
//# sourceMappingURL=trust.controller.js.map