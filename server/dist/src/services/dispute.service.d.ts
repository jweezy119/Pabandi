import { DisputeType } from '@prisma/client';
export declare class DisputeService {
    /**
     * File a new dispute. Requires the filer to stake a certain amount of PAB.
     * For MVP, we simulate the staking by just recording the amount.
     */
    createDispute(reservationId: string, reportedById: string, userId: string, description: string, evidenceUrls: string[], stakedAmount?: number): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        description: string | null;
        type: import(".prisma/client").$Enums.DisputeType;
        reservationId: string | null;
        hashedIdentityId: string | null;
        reportedById: string | null;
        apiClientId: string | null;
        outcome: import(".prisma/client").$Enums.DisputeOutcome;
        resolvedAt: Date | null;
        stakedAmount: number;
        contextType: string | null;
        contextId: string | null;
        evidenceUrls: string[];
    }>;
    /**
     * File a dispute against a paid-work context (milestone release, off-ramp payout, etc.).
     * This is the #3 "dispute arbitration" entry point for pay-on-verified-work & off-ramp.
     * Trust-gated: filer must have a wallet; stake is recorded. Low-value claims auto-arbitrate.
     */
    fileContextDispute(opts: {
        reportedById: string;
        againstId: string;
        contextType: 'MILESTONE' | 'OFFRAMP' | 'PAYOUT' | 'RESERVATION';
        contextId: string;
        type?: DisputeType;
        description: string;
        evidenceUrls?: string[];
        stakedAmount?: number;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string | null;
        description: string | null;
        type: import(".prisma/client").$Enums.DisputeType;
        reservationId: string | null;
        hashedIdentityId: string | null;
        reportedById: string | null;
        apiClientId: string | null;
        outcome: import(".prisma/client").$Enums.DisputeOutcome;
        resolvedAt: Date | null;
        stakedAmount: number;
        contextType: string | null;
        contextId: string | null;
        evidenceUrls: string[];
    }>;
    /** Resolve the USD claim amount for a paid-work context. */
    private resolveClaimAmount;
    /**
     * Cast a vote as a Peer Juror.
     * Juror must have a trust score > 90.
     */
    castVote(disputeId: string, jurorId: string, voteForId: string, reason?: string): Promise<{
        id: string;
        createdAt: Date;
        reason: string | null;
        jurorId: string;
        voteForId: string;
        disputeId: string;
    }>;
    /**
     * Resolves the dispute if a threshold is met.
     */
    private checkAndResolveDispute;
    assignJurors(disputeId: string, excludeIds?: string[]): Promise<string[]>;
    private resolveDispute;
    /** Claw back a worker's instant pay when a milestone/off-ramp dispute is upheld. */
    private clawbackContext;
}
//# sourceMappingURL=dispute.service.d.ts.map