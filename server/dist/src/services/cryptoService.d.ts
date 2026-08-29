export declare const PAB_REWARD_RULES: {
    readonly customer: {
        readonly CHECK_IN: 50;
        readonly GOOGLE_REVIEW: 200;
        readonly REFERRAL: 100;
        readonly STREAK_BONUS: 25;
    };
    readonly business: {
        readonly HONORED_BOOKING: 25;
        readonly NO_SHOW_DEPOSIT_KEPT: 40;
        readonly LOW_NO_SHOW_MONTH: 75;
        readonly CUSTOMER_REFERRAL: 150;
        readonly PAYOUT_TO_SOLANA: true;
    };
};
export type RewardType = 'RESERVATION_COMPLETION' | 'GOOGLE_REVIEW' | 'REFERRAL' | 'STREAK_BONUS' | 'BUSINESS_RESERVATION_HONORED' | 'BUSINESS_NO_SHOW_PROTECTED' | 'BUSINESS_RELIABILITY_BONUS' | 'BUSINESS_REFERRAL' | 'VERIFICATION_BOUNTY';
export declare class CryptoService {
    private creditPab;
    /**
     * Reward customer for completing a reservation (verified check-in).
     */
    rewardReservationCompletion(userId: string, reservationId: string): Promise<void>;
    /**
     * Reward customer with 1% cashback for booking via AI Concierge.
     */
    triggerConciergeCashback(userId: string, reservationId: string): Promise<void>;
    /**
     * Reward business owner when they honor a completed booking.
     */
    rewardBusinessForCompletion(businessId: string, reservationId: string): Promise<void>;
    /**
     * Reward business when a no-show occurs and deposit protection applies.
     */
    rewardBusinessNoShowProtected(businessId: string, reservationId: string): Promise<void>;
    /**
     * Reward user for leaving a Google review.
     */
    rewardGoogleReview(userId: string, _businessId: string, _googleReviewId: string): Promise<void>;
    /**
     * Connect or update Solana (Phantom) wallet for payouts.
     */
    connectSolanaWallet(userId: string, address: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        address: string | null;
        currency: string;
        encryptedSecret: string | null;
        balance: number;
        totalStaked: number;
        lockedPab: number;
        usdcBalance: number;
        airdropClaimed: boolean;
        airdropAmount: number | null;
        airdropClaimedAt: Date | null;
    }>;
    /**
     * Withdraw PAB to connected Solana wallet.
     */
    withdrawToSolana(userId: string, amount: number): Promise<{
        txHash?: string;
        success: boolean;
        message: string;
    }>;
    /**
     * Get wallet + recent rewards for any user.
     */
    getWalletData(userId: string): Promise<{
        balance: number;
        currency: string;
        solanaAddress: string | null | undefined;
        chain: string | null;
        totalEarned: number;
        recentRewards: {
            id: string;
            type: string;
            amount: number;
            status: string;
            createdAt: Date;
            metadata: import("@prisma/client/runtime/library").JsonValue;
            businessName: string | undefined;
            reservationId: string | null;
        }[];
    }>;
    /**
     * Business owner: PAB earnings breakdown and Solana payout readiness.
     */
    getBusinessRewardsSummary(ownerId: string): Promise<{
        balance: number;
        currency: string;
        totalBusinessPab: number;
        solanaConnected: boolean;
        solanaAddress: string | null;
        rules: {
            readonly HONORED_BOOKING: 25;
            readonly NO_SHOW_DEPOSIT_KEPT: 40;
            readonly LOW_NO_SHOW_MONTH: 75;
            readonly CUSTOMER_REFERRAL: 150;
            readonly PAYOUT_TO_SOLANA: true;
        };
        breakdown: {
            type: string;
            count: number;
            total: number;
        }[];
        recentRewards: {
            id: string;
            metadata: import("@prisma/client/runtime/library").JsonValue | null;
            createdAt: Date;
            userId: string;
            status: string;
            type: string;
            amount: number;
            txHash: string | null;
            reservationId: string | null;
        }[];
    }>;
    getPublicRewardRules(): {
        readonly customer: {
            readonly CHECK_IN: 50;
            readonly GOOGLE_REVIEW: 200;
            readonly REFERRAL: 100;
            readonly STREAK_BONUS: 25;
        };
        readonly business: {
            readonly HONORED_BOOKING: 25;
            readonly NO_SHOW_DEPOSIT_KEPT: 40;
            readonly LOW_NO_SHOW_MONTH: 75;
            readonly CUSTOMER_REFERRAL: 150;
            readonly PAYOUT_TO_SOLANA: true;
        };
    };
    /**
     * Generates a signature for a Trust Attestation using the platform's private key.
     */
    signAttestationData(dataBuffer: Uint8Array): {
        signature: string;
        pubkey: string;
    };
    /**
     * Verify an Ed25519 signature.
     */
    verifyAttestationSignature(dataBuffer: Uint8Array, signatureBase58: string, pubkeyBase58: string): boolean;
    /**
     * Issue a Verification Bounty (PAB Airdrop)
     */
    issueVerificationBounty(userId: string, amount: number): Promise<void>;
    /**
     * Called when a reservation is COMPLETED or NO_SHOW.
     * Releases escrowed funds to the business minus the platform fee.
     */
    releaseEscrowToBusiness(reservationId: string): Promise<void>;
    /**
     * Called when a reservation is CANCELLED by business.
     * Refunds escrowed funds 100% back to customer.
     */
    refundEscrowToCustomer(reservationId: string): Promise<void>;
    /**
     * Mint a Proof of Visit (POV) Soulbound Token for a customer
     */
    mintProofOfVisit(customerWallet: string, businessId: string, businessName: string): Promise<{
        txHash: string;
        tokenId: string;
    } | null>;
    /**
     * Check if a user holds a Proof of Visit token for a specific business
     */
    hasVisited(customerWallet: string, businessId: string): Promise<boolean>;
    private getTreasuryBucket;
    creditTreasury(amount: number, bucket: 'OPERATING' | 'LP_PROVISION' | 'YIELD_REINVEST' | 'EMERGENCY'): Promise<void>;
    calculateEscrowFee(businessTrustScore: number): number;
    generateDynamicFeeSignature(reservationId: string, businessAddress: string, trustScore: number): Promise<{
        feeBps: number;
        signature: string;
    }>;
}
export declare const cryptoService: CryptoService;
//# sourceMappingURL=cryptoService.d.ts.map