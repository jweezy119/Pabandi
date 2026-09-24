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
            text: string | null;
            verified: boolean;
            workType: string;
            zkProofId: string | null;
            ambassadorId: string;
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