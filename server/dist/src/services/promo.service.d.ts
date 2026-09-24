export declare const promoService: {
    createAmbassador(data: {
        userId?: string;
        handle: string;
        workType: string;
        bio?: string;
        portfolioUrl?: string;
        zkPublicKey?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        handle: string;
        bio: string | null;
        active: boolean;
        workType: string;
        portfolioUrl: string | null;
        verifiedBadges: string[];
        reputationScore: number;
        totalJobs: number;
        completedJobs: number;
        totalEarnings: number;
        zkPublicKey: string | null;
        stakedPab: number;
        stakeTier: string | null;
    }>;
    listAmbassadors(params?: {
        workType?: string;
        minReputation?: number;
        active?: boolean;
    }): Promise<({
        _count: {
            reviews: number;
            submissions: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        handle: string;
        bio: string | null;
        active: boolean;
        workType: string;
        portfolioUrl: string | null;
        verifiedBadges: string[];
        reputationScore: number;
        totalJobs: number;
        completedJobs: number;
        totalEarnings: number;
        zkPublicKey: string | null;
        stakedPab: number;
        stakeTier: string | null;
    })[]>;
    getAmbassador(id: string): Promise<({
        _count: {
            reviews: number;
            submissions: number;
        };
        reviews: {
            id: string;
            createdAt: Date;
            rating: number;
            text: string | null;
            verified: boolean;
            workType: string;
            zkProofId: string | null;
            ambassadorId: string;
            submissionId: string;
            zkCommitment: string | null;
        }[];
        submissions: ({
            job: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                status: string;
                description: string;
                title: string;
                deadline: Date | null;
                escrowStatus: string | null;
                budgetUsd: number;
                requirements: string[];
                workType: string;
                brandId: string | null;
                brandName: string | null;
                maxAmbassadors: number;
                zkRequired: boolean;
                escrowAmount: number | null;
                brandVerified: boolean;
            };
        } & {
            id: string;
            status: string;
            description: string | null;
            jobId: string;
            payoutAmount: number | null;
            submittedAt: Date;
            contentUrl: string | null;
            zkProofId: string | null;
            rakeAmount: number | null;
            reviewedAt: Date | null;
            reviewNotes: string | null;
            ambassadorId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        handle: string;
        bio: string | null;
        active: boolean;
        workType: string;
        portfolioUrl: string | null;
        verifiedBadges: string[];
        reputationScore: number;
        totalJobs: number;
        completedJobs: number;
        totalEarnings: number;
        zkPublicKey: string | null;
        stakedPab: number;
        stakeTier: string | null;
    }) | null>;
    updateAmbassador(id: string, data: Partial<{
        handle: string;
        bio: string;
        portfolioUrl: string;
        workType: string;
    }>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        handle: string;
        bio: string | null;
        active: boolean;
        workType: string;
        portfolioUrl: string | null;
        verifiedBadges: string[];
        reputationScore: number;
        totalJobs: number;
        completedJobs: number;
        totalEarnings: number;
        zkPublicKey: string | null;
        stakedPab: number;
        stakeTier: string | null;
    }>;
    createJob(data: {
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
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        title: string;
        deadline: Date | null;
        escrowStatus: string | null;
        budgetUsd: number;
        requirements: string[];
        workType: string;
        brandId: string | null;
        brandName: string | null;
        maxAmbassadors: number;
        zkRequired: boolean;
        escrowAmount: number | null;
        brandVerified: boolean;
    }>;
    listJobs(params?: {
        workType?: string;
        status?: string;
        brandId?: string;
    }): Promise<({
        _count: {
            submissions: number;
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        title: string;
        deadline: Date | null;
        escrowStatus: string | null;
        budgetUsd: number;
        requirements: string[];
        workType: string;
        brandId: string | null;
        brandName: string | null;
        maxAmbassadors: number;
        zkRequired: boolean;
        escrowAmount: number | null;
        brandVerified: boolean;
    })[]>;
    getJob(id: string): Promise<({
        _count: {
            submissions: number;
        };
        submissions: ({
            ambassador: {
                id: string;
                handle: string;
                workType: string;
                reputationScore: number;
            };
        } & {
            id: string;
            status: string;
            description: string | null;
            jobId: string;
            payoutAmount: number | null;
            submittedAt: Date;
            contentUrl: string | null;
            zkProofId: string | null;
            rakeAmount: number | null;
            reviewedAt: Date | null;
            reviewNotes: string | null;
            ambassadorId: string;
        })[];
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        title: string;
        deadline: Date | null;
        escrowStatus: string | null;
        budgetUsd: number;
        requirements: string[];
        workType: string;
        brandId: string | null;
        brandName: string | null;
        maxAmbassadors: number;
        zkRequired: boolean;
        escrowAmount: number | null;
        brandVerified: boolean;
    }) | null>;
    updateJobStatus(id: string, status: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: string;
        description: string;
        title: string;
        deadline: Date | null;
        escrowStatus: string | null;
        budgetUsd: number;
        requirements: string[];
        workType: string;
        brandId: string | null;
        brandName: string | null;
        maxAmbassadors: number;
        zkRequired: boolean;
        escrowAmount: number | null;
        brandVerified: boolean;
    }>;
    createSubmission(data: {
        jobId: string;
        ambassadorId: string;
        contentUrl?: string;
        description?: string;
        zkProofId?: string;
    }): Promise<{
        job: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            description: string;
            title: string;
            deadline: Date | null;
            escrowStatus: string | null;
            budgetUsd: number;
            requirements: string[];
            workType: string;
            brandId: string | null;
            brandName: string | null;
            maxAmbassadors: number;
            zkRequired: boolean;
            escrowAmount: number | null;
            brandVerified: boolean;
        };
        ambassador: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string | null;
            handle: string;
            bio: string | null;
            active: boolean;
            workType: string;
            portfolioUrl: string | null;
            verifiedBadges: string[];
            reputationScore: number;
            totalJobs: number;
            completedJobs: number;
            totalEarnings: number;
            zkPublicKey: string | null;
            stakedPab: number;
            stakeTier: string | null;
        };
    } & {
        id: string;
        status: string;
        description: string | null;
        jobId: string;
        payoutAmount: number | null;
        submittedAt: Date;
        contentUrl: string | null;
        zkProofId: string | null;
        rakeAmount: number | null;
        reviewedAt: Date | null;
        reviewNotes: string | null;
        ambassadorId: string;
    }>;
    listSubmissions(params?: {
        jobId?: string;
        ambassadorId?: string;
        status?: string;
    }): Promise<({
        job: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            status: string;
            description: string;
            title: string;
            deadline: Date | null;
            escrowStatus: string | null;
            budgetUsd: number;
            requirements: string[];
            workType: string;
            brandId: string | null;
            brandName: string | null;
            maxAmbassadors: number;
            zkRequired: boolean;
            escrowAmount: number | null;
            brandVerified: boolean;
        };
        ambassador: {
            id: string;
            handle: string;
            reputationScore: number;
        };
    } & {
        id: string;
        status: string;
        description: string | null;
        jobId: string;
        payoutAmount: number | null;
        submittedAt: Date;
        contentUrl: string | null;
        zkProofId: string | null;
        rakeAmount: number | null;
        reviewedAt: Date | null;
        reviewNotes: string | null;
        ambassadorId: string;
    })[]>;
    updateSubmissionStatus(id: string, status: string, reviewNotes?: string): Promise<{
        id: string;
        status: string;
        description: string | null;
        jobId: string;
        payoutAmount: number | null;
        submittedAt: Date;
        contentUrl: string | null;
        zkProofId: string | null;
        rakeAmount: number | null;
        reviewedAt: Date | null;
        reviewNotes: string | null;
        ambassadorId: string;
    }>;
    createReview(data: {
        submissionId: string;
        ambassadorId: string;
        rating: number;
        text?: string;
        zkProofId?: string;
        zkCommitment?: string;
        workType: string;
        verified?: boolean;
    }): Promise<{
        id: string;
        createdAt: Date;
        rating: number;
        text: string | null;
        verified: boolean;
        workType: string;
        zkProofId: string | null;
        ambassadorId: string;
        submissionId: string;
        zkCommitment: string | null;
    }>;
    listReviews(params?: {
        workType?: string;
        verified?: boolean;
        minRating?: number;
    }): Promise<({
        ambassador: {
            id: string;
            handle: string;
            workType: string;
        };
    } & {
        id: string;
        createdAt: Date;
        rating: number;
        text: string | null;
        verified: boolean;
        workType: string;
        zkProofId: string | null;
        ambassadorId: string;
        submissionId: string;
        zkCommitment: string | null;
    })[]>;
    generateZKCommitment(ambassadorId: string, secret: string): string;
    verifyZKCommitment(ambassadorId: string, secret: string, commitment: string): boolean;
    generateWorkProof(ambassadorId: string, jobId: string, workHash: string): {
        proofId: string;
        commitment: string;
    };
    getStats(): Promise<{
        totalAmbassadors: number;
        totalJobs: number;
        totalSubmissions: number;
        totalReviews: number;
        avgRating: number;
    }>;
};
//# sourceMappingURL=promo.service.d.ts.map