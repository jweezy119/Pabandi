"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.promoService = void 0;
const client_1 = require("@prisma/client");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
exports.promoService = {
    // ── Ambassador CRUD ──────────────────────────────────────────────────────
    async createAmbassador(data) {
        return prisma.promoAmbassador.create({
            data: {
                userId: data.userId || null,
                handle: data.handle,
                workType: data.workType,
                bio: data.bio || null,
                portfolioUrl: data.portfolioUrl || null,
                zkPublicKey: data.zkPublicKey || null,
            },
        });
    },
    async listAmbassadors(params) {
        const where = {};
        if (params?.workType)
            where.workType = params.workType;
        if (params?.minReputation)
            where.reputationScore = { gte: params.minReputation };
        if (params?.active !== undefined)
            where.active = params.active;
        return prisma.promoAmbassador.findMany({
            where,
            orderBy: { reputationScore: 'desc' },
            include: { _count: { select: { submissions: true, reviews: true } } },
        });
    },
    async getAmbassador(id) {
        return prisma.promoAmbassador.findUnique({
            where: { id },
            include: {
                submissions: { include: { job: true }, orderBy: { submittedAt: 'desc' }, take: 20 },
                reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
                _count: { select: { submissions: true, reviews: true } },
            },
        });
    },
    async updateAmbassador(id, data) {
        return prisma.promoAmbassador.update({ where: { id }, data });
    },
    // ── Job CRUD ─────────────────────────────────────────────────────────────
    async createJob(data) {
        return prisma.promoJob.create({
            data: {
                brandId: data.brandId || null,
                brandName: data.brandName || null,
                title: data.title,
                description: data.description,
                workType: data.workType,
                budgetUsd: data.budgetUsd,
                deadline: data.deadline || null,
                requirements: data.requirements || [],
                maxAmbassadors: data.maxAmbassadors || 1,
                zkRequired: data.zkRequired !== false,
            },
        });
    },
    async listJobs(params) {
        const where = {};
        if (params?.workType)
            where.workType = params.workType;
        if (params?.status)
            where.status = params.status;
        if (params?.brandId)
            where.brandId = params.brandId;
        return prisma.promoJob.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { _count: { select: { submissions: true } } },
        });
    },
    async getJob(id) {
        return prisma.promoJob.findUnique({
            where: { id },
            include: {
                submissions: {
                    include: { ambassador: { select: { id: true, handle: true, reputationScore: true, workType: true } } },
                    orderBy: { submittedAt: 'desc' },
                },
                _count: { select: { submissions: true } },
            },
        });
    },
    async updateJobStatus(id, status) {
        return prisma.promoJob.update({ where: { id }, data: { status } });
    },
    // ── Submission CRUD ──────────────────────────────────────────────────────
    async createSubmission(data) {
        return prisma.promoSubmission.create({
            data: {
                jobId: data.jobId,
                ambassadorId: data.ambassadorId,
                contentUrl: data.contentUrl || null,
                description: data.description || null,
                zkProofId: data.zkProofId || null,
            },
            include: { job: true, ambassador: true },
        });
    },
    async listSubmissions(params) {
        const where = {};
        if (params?.jobId)
            where.jobId = params.jobId;
        if (params?.ambassadorId)
            where.ambassadorId = params.ambassadorId;
        if (params?.status)
            where.status = params.status;
        return prisma.promoSubmission.findMany({
            where,
            orderBy: { submittedAt: 'desc' },
            include: { job: true, ambassador: { select: { id: true, handle: true, reputationScore: true } } },
        });
    },
    async updateSubmissionStatus(id, status, reviewNotes) {
        return prisma.promoSubmission.update({
            where: { id },
            data: { status, reviewNotes: reviewNotes || null, reviewedAt: new Date() },
        });
    },
    // ── Review CRUD ──────────────────────────────────────────────────────────
    async createReview(data) {
        return prisma.promoReview.create({
            data: {
                submissionId: data.submissionId,
                ambassadorId: data.ambassadorId,
                rating: data.rating,
                text: data.text || null,
                zkProofId: data.zkProofId || null,
                zkCommitment: data.zkCommitment || null,
                workType: data.workType,
                verified: data.verified || false,
            },
        });
    },
    async listReviews(params) {
        const where = {};
        if (params?.workType)
            where.workType = params.workType;
        if (params?.verified !== undefined)
            where.verified = params.verified;
        if (params?.minRating)
            where.rating = { gte: params.minRating };
        return prisma.promoReview.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: { ambassador: { select: { id: true, handle: true, workType: true } } },
        });
    },
    // ── ZK Proof helpers ─────────────────────────────────────────────────────
    // Generate a ZK commitment that proves ambassador identity without revealing it
    generateZKCommitment(ambassadorId, secret) {
        return crypto_1.default.createHash('sha256').update(`${ambassadorId}:${secret}:pabandi-promo`).digest('hex');
    },
    // Verify a ZK commitment matches an ambassador
    verifyZKCommitment(ambassadorId, secret, commitment) {
        const expected = this.generateZKCommitment(ambassadorId, secret);
        return expected === commitment;
    },
    // Generate a work completion proof (simplified ZK-style)
    generateWorkProof(ambassadorId, jobId, workHash) {
        const proofId = `promo_${crypto_1.default.randomBytes(8).toString('hex')}`;
        const commitment = crypto_1.default.createHash('sha256').update(`${ambassadorId}:${jobId}:${workHash}:pabandi-work`).digest('hex');
        return { proofId, commitment };
    },
    // ── Stats ────────────────────────────────────────────────────────────────
    async getStats() {
        const [totalAmbassadors, totalJobs, totalSubmissions, totalReviews, avgRating] = await Promise.all([
            prisma.promoAmbassador.count(),
            prisma.promoJob.count(),
            prisma.promoSubmission.count(),
            prisma.promoReview.count(),
            prisma.promoReview.aggregate({ _avg: { rating: true } }),
        ]);
        return {
            totalAmbassadors,
            totalJobs,
            totalSubmissions,
            totalReviews,
            avgRating: avgRating._avg.rating || 0,
        };
    },
};
//# sourceMappingURL=promo.service.js.map