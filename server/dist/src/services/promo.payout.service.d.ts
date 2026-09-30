export declare const promoPayoutService: {
    fundJob(jobId: string, brandId: string): Promise<{
        success: boolean;
        jobId: string;
        amount: number;
        status: string;
    }>;
    submitWork(data: {
        jobId: string;
        ambassadorId: string;
        contentUrl?: string;
        description?: string;
        workHash: string;
    }): Promise<{
        success: boolean;
        submission: {
            job: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                status: string;
                title: string;
                description: string;
                requirements: string[];
                budgetUsd: number;
                workType: string;
                brandId: string | null;
                brandName: string | null;
                deadline: Date | null;
                maxAmbassadors: number;
                zkRequired: boolean;
                escrowAmount: number | null;
                escrowStatus: string | null;
                brandVerified: boolean;
            };
            ambassador: {
                id: string;
                userId: string | null;
                createdAt: Date;
                updatedAt: Date;
                bio: string | null;
                active: boolean;
                handle: string;
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
            submittedAt: Date;
            reviewedAt: Date | null;
            ambassadorId: string;
            contentUrl: string | null;
            zkProofId: string | null;
            payoutAmount: number | null;
            rakeAmount: number | null;
            reviewNotes: string | null;
        };
        proofId: string;
        commitment: string;
    }>;
    acceptAndPay(submissionId: string, brandId: string): Promise<{
        success: boolean;
        submissionId: string;
        ambassadorEarns: number;
        rake: number;
        jobId: string;
    }>;
    submitReview(data: {
        submissionId: string;
        ambassadorId: string;
        rating: number;
        text?: string;
        workType: string;
        zkSecret: string;
    }): Promise<{
        success: boolean;
        review: {
            id: string;
            createdAt: Date;
            rating: number;
            verified: boolean;
            text: string | null;
            workType: string;
            ambassadorId: string;
            zkProofId: string | null;
            submissionId: string;
            zkCommitment: string | null;
        };
        zkCommitment: string;
        zkProofId: string;
        mintResult: {
            skipped: boolean;
            success?: undefined;
            amount?: undefined;
            mintResult?: undefined;
        } | {
            success: boolean;
            amount: number;
            mintResult: any;
            skipped?: undefined;
        };
    }>;
    rewardReview(ambassadorId: string, zkVerified: boolean): Promise<{
        skipped: boolean;
        success?: undefined;
        amount?: undefined;
        mintResult?: undefined;
    } | {
        success: boolean;
        amount: number;
        mintResult: any;
        skipped?: undefined;
    }>;
    mintPabOnSolana(walletAddress: string, amount: number, rewardType: string): Promise<{
        success: boolean;
        txHash: string;
        amount: number;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        txHash?: undefined;
        amount?: undefined;
    }>;
    verifyCommitment(ambassadorId: string, secret: string, commitment: string): boolean;
    getEarnings(ambassadorId: string): Promise<{
        totalEarnings: number;
        totalReviews: number;
        totalPabRewards: number;
        completedJobs: number;
        reputationScore: number;
    }>;
};
//# sourceMappingURL=promo.payout.service.d.ts.map