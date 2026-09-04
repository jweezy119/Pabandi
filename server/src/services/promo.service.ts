import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const promoService = {
  // ── Ambassador CRUD ──────────────────────────────────────────────────────
  async createAmbassador(data: {
    userId?: string;
    handle: string;
    workType: string;
    bio?: string;
    portfolioUrl?: string;
    zkPublicKey?: string;
  }) {
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

  async listAmbassadors(params?: { workType?: string; minReputation?: number; active?: boolean }) {
    const where: any = {};
    if (params?.workType) where.workType = params.workType;
    if (params?.minReputation) where.reputationScore = { gte: params.minReputation };
    if (params?.active !== undefined) where.active = params.active;
    return prisma.promoAmbassador.findMany({
      where,
      orderBy: { reputationScore: 'desc' },
      include: { _count: { select: { submissions: true, reviews: true } } },
    });
  },

  async getAmbassador(id: string) {
    return prisma.promoAmbassador.findUnique({
      where: { id },
      include: {
        submissions: { include: { job: true }, orderBy: { submittedAt: 'desc' }, take: 20 },
        reviews: { orderBy: { createdAt: 'desc' }, take: 20 },
        _count: { select: { submissions: true, reviews: true } },
      },
    });
  },

  async updateAmbassador(id: string, data: Partial<{ handle: string; bio: string; portfolioUrl: string; workType: string }>) {
    return prisma.promoAmbassador.update({ where: { id }, data });
  },

  // ── Job CRUD ─────────────────────────────────────────────────────────────
  async createJob(data: {
    brandId?: string;
    brandName?: string;
    title: string;
    description: string;
    workType: string;
    budgetUsd: number;
    deadline?: Date;
    requirements?: string[];
    maxAmbassadors?: number;
    zkRequired?: boolean;
  }) {
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

  async listJobs(params?: { workType?: string; status?: string; brandId?: string }) {
    const where: any = {};
    if (params?.workType) where.workType = params.workType;
    if (params?.status) where.status = params.status;
    if (params?.brandId) where.brandId = params.brandId;
    return prisma.promoJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { submissions: true } } },
    });
  },

  async getJob(id: string) {
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

  async updateJobStatus(id: string, status: string) {
    return prisma.promoJob.update({ where: { id }, data: { status } });
  },

  // ── Submission CRUD ──────────────────────────────────────────────────────
  async createSubmission(data: {
    jobId: string;
    ambassadorId: string;
    contentUrl?: string;
    description?: string;
    zkProofId?: string;
  }) {
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

  async listSubmissions(params?: { jobId?: string; ambassadorId?: string; status?: string }) {
    const where: any = {};
    if (params?.jobId) where.jobId = params.jobId;
    if (params?.ambassadorId) where.ambassadorId = params.ambassadorId;
    if (params?.status) where.status = params.status;
    return prisma.promoSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: { job: true, ambassador: { select: { id: true, handle: true, reputationScore: true } } },
    });
  },

  async updateSubmissionStatus(id: string, status: string, reviewNotes?: string) {
    return prisma.promoSubmission.update({
      where: { id },
      data: { status, reviewNotes: reviewNotes || null, reviewedAt: new Date() },
    });
  },

  // ── Review CRUD ──────────────────────────────────────────────────────────
  async createReview(data: {
    submissionId: string;
    ambassadorId: string;
    rating: number;
    text?: string;
    zkProofId?: string;
    zkCommitment?: string;
    workType: string;
    verified?: boolean;
  }) {
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

  async listReviews(params?: { workType?: string; verified?: boolean; minRating?: number }) {
    const where: any = {};
    if (params?.workType) where.workType = params.workType;
    if (params?.verified !== undefined) where.verified = params.verified;
    if (params?.minRating) where.rating = { gte: params.minRating };
    return prisma.promoReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { ambassador: { select: { id: true, handle: true, workType: true } } },
    });
  },

  // ── ZK Proof helpers ─────────────────────────────────────────────────────
  // Generate a ZK commitment that proves ambassador identity without revealing it
  generateZKCommitment(ambassadorId: string, secret: string): string {
    return crypto.createHash('sha256').update(`${ambassadorId}:${secret}:pabandi-promo`).digest('hex');
  },

  // Verify a ZK commitment matches an ambassador
  verifyZKCommitment(ambassadorId: string, secret: string, commitment: string): boolean {
    const expected = this.generateZKCommitment(ambassadorId, secret);
    return expected === commitment;
  },

  // Generate a work completion proof (simplified ZK-style)
  generateWorkProof(ambassadorId: string, jobId: string, workHash: string): { proofId: string; commitment: string } {
    const proofId = `promo_${crypto.randomBytes(8).toString('hex')}`;
    const commitment = crypto.createHash('sha256').update(`${ambassadorId}:${jobId}:${workHash}:pabandi-work`).digest('hex');
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
