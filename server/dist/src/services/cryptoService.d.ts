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
    rewardReservationCompletion(userId: string, reservationId: string): Promise<void>;
    triggerConciergeCashback(userId: string, reservationId: string): Promise<void>;
    rewardBusinessForCompletion(businessId: string, reservationId: string): Promise<void>;
    rewardBusinessNoShowProtected(businessId: string, reservationId: string): Promise<void>;
    rewardGoogleReview(userId: string, _businessId: string, _googleReviewId: string): Promise<void>;
    connectSolanaWallet(userId: string, address: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        usdcBalance: number;
        userId: string;
        address: string | null;
        currency: string;
        encryptedSecret: string | null;
        balance: number;
        totalStaked: number;
        lockedPab: number;
        airdropClaimed: boolean;
        airdropAmount: number | null;
        airdropClaimedAt: Date | null;
    }>;
    withdrawToSolana(userId: string, amount: number): Promise<{
        txHash?: string;
        success: boolean;
        message: string;
    }>;
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
    signAttestationData(dataBuffer: Uint8Array): {
        signature: string;
        pubkey: string;
    };
    verifyAttestationSignature(dataBuffer: Uint8Array, signatureBase58: string, pubkeyBase58: string): boolean;
    mintProofOfVisit(_customerWallet: string, _businessId: string, _businessName: string): Promise<{
        txHash: string;
        tokenId: string;
    } | null>;
    hasVisited(_customerWallet: string, _businessId: string): Promise<boolean>;
    refundEscrowToCustomer(reservationId: string): Promise<any>;
    releaseEscrowToBusiness(reservationId: string): Promise<any>;
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