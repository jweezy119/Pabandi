"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../utils/database");
const dispute_service_1 = require("../services/dispute.service");
const auth_middleware_1 = require("../middleware/auth.middleware");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const disputeService = new dispute_service_1.DisputeService();
/**
 * @route POST /api/v1/disputes
 * @desc File a dispute (legacy reservation-based)
 */
router.post('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { reservationId, againstId, reason, evidenceUrls, stakedAmount } = req.body;
        const filedById = req.user.id;
        if (!reservationId || !againstId || !reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const dispute = await disputeService.createDispute(reservationId, filedById, againstId, reason, evidenceUrls || [], stakedAmount || 10);
        res.status(201).json({ message: 'Dispute filed successfully', dispute });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * @route POST /api/v1/disputes/context
 * @desc File a dispute against a paid-work context (milestone release / off-ramp payout).
 *       This is the #3 "dispute arbitration" entry point for pay-on-verified-work & off-ramp.
 */
router.post('/context', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { contextType, contextId, againstId, type, description, evidenceUrls, stakedAmount } = req.body;
        if (!contextType || !contextId || !againstId || !description) {
            return res.status(400).json({ error: 'contextType, contextId, againstId, and description are required' });
        }
        const dispute = await disputeService.fileContextDispute({
            reportedById: req.user.id,
            againstId,
            contextType,
            contextId,
            type,
            description,
            evidenceUrls: evidenceUrls || [],
            stakedAmount,
        });
        res.status(201).json({ message: 'Dispute filed', dispute });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * @route GET /api/v1/disputes
 * @desc List disputes (open ones for jurors; all for admins). Public-friendly: returns
 *       enough for the community arbitration board without leaking PII.
 */
router.get('/', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const { status } = req.query;
        const where = {};
        if (status)
            where.outcome = status;
        else
            where.outcome = { in: [client_1.DisputeOutcome.PENDING, client_1.DisputeOutcome.VOTING] };
        const list = await database_1.prisma.dispute.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50,
            include: { votes: true },
        });
        // Attach each disputed party's (userId) latest background-check verdict
        // so jurors see the real trust signal while voting. Disputed party = userId.
        const userIds = [...new Set(list.map((d) => d.userId).filter(Boolean))];
        const checksByUser = {};
        if (userIds.length) {
            const rs = await database_1.prisma.backgroundCheck.findMany({
                where: { subjectId: { in: userIds }, status: 'COMPLETE', recommendation: { in: ['PASS', 'REVIEW', 'REJECT'] } },
                orderBy: { updatedAt: 'desc' },
            });
            for (const c of rs) {
                const sid = c.subjectId;
                if (sid && !checksByUser[sid]) {
                    checksByUser[sid] = c;
                }
            }
        }
        const disputes = list.map((d) => ({
            ...d,
            check: d.userId ? checksByUser[d.userId] ?? null : null,
        }));
        res.json({ disputes });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * @route GET /api/v1/disputes/:id
 * @desc Dispute detail (public arbitration view).
 */
router.get('/:id', async (req, res) => {
    try {
        const { prisma } = require('../utils/database');
        const dispute = await prisma.dispute.findUnique({
            where: { id: req.params.id },
            include: { votes: true },
        });
        if (!dispute)
            return res.status(404).json({ error: 'Dispute not found' });
        // Attach the disputed party's latest background-check verdict (real signal).
        let check = null;
        if (dispute.userId) {
            check = await prisma.backgroundCheck.findFirst({
                where: { subjectId: dispute.userId, status: 'COMPLETE', recommendation: { in: ['PASS', 'REVIEW', 'REJECT'] } },
                orderBy: { updatedAt: 'desc' },
            });
        }
        res.json({ dispute: { ...dispute, check: check ?? null } });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * @route POST /api/v1/disputes/:id/vote
 * @desc Cast a vote on an active dispute (peer juror, trust score > 90)
 */
router.post('/:id/vote', auth_middleware_1.authenticate, async (req, res) => {
    try {
        const disputeId = req.params.id;
        const jurorId = req.user.id;
        const { voteForId, reason } = req.body;
        if (!voteForId) {
            return res.status(400).json({ error: 'Must specify who you are voting for (voteForId)' });
        }
        const vote = await disputeService.castVote(disputeId, jurorId, voteForId, reason);
        res.status(200).json({ message: 'Vote cast successfully', vote });
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
/**
 * @route POST /api/v1/disputes/migrate
 * @desc Add contextType/contextId columns (Cloud Run FS read-only)
 */
router.post('/migrate', async (_req, res) => {
    try {
        const { prisma } = require('../utils/database');
        await prisma.$executeRawUnsafe(`ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "contextType" TEXT`);
        await prisma.$executeRawUnsafe(`ALTER TABLE "Dispute" ADD COLUMN IF NOT EXISTS "contextId" TEXT`);
        await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Dispute_ctx_idx" ON "Dispute"("contextType","contextId")`);
        res.json({ success: true, message: 'Dispute columns migrated' });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=dispute.routes.js.map