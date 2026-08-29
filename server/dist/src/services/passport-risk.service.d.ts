export type PassportCategory = 'hospitality' | 'live_selling' | 'freelance' | 'gig' | 'general';
export interface PassportScoreComponents {
    base: number;
    disputePenalty: number;
    stakeBonus: number;
    socialBonus: number;
    channelBonus: number;
}
export interface PassportScoreResult {
    userId: string;
    category: PassportCategory;
    categoryScore: number;
    compositeScore: number;
    tier: string;
    penalty: number;
    stakeBonus: number;
    socialBonus: number;
    channelBonus: number;
    components: PassportScoreComponents;
}
export interface MyPassportResult {
    owner: string;
    trustScore: number;
    axes: PassportScoreResult[];
    tier: PassportScoreResult;
    activeStake: number;
    activeFlags: number;
    exportUrl: string;
}
export interface PublicPassportResult {
    owner: string;
    trustScore: number;
    tier: PassportScoreResult;
    activeFlags: number;
    axes: {
        category: PassportCategory;
        compositeScore: number;
        tier: string;
    }[];
}
export interface VouchResult {
    targetUserId: string;
    newCompositeScore: number;
    tier: string;
    category: string;
}
export interface WhatsAppChannelSignalResult {
    userId: string;
    signalCategory: string;
    scoreDelta: number;
    newCompositeScore: number;
    tier: string;
}
export interface SocialGraphSignalResult {
    userId: string;
    signalCategory: string;
    scoreDelta: number;
    newCompositeScore: number;
    tier: string;
}
export interface Web3StakeRecordResult {
    userId: string;
    stakeAmount: number;
    stakeBonus: number;
    newCompositeScore: number;
    tier: string;
}
export interface PassportExportResult {
    exportedAt: string;
    passport: MyPassportResult;
    schemaVersion: string;
}
export declare const computePassportScore: (userId: string, category?: PassportCategory) => Promise<PassportScoreResult>;
export declare const getMyPassport: (userId: string) => Promise<MyPassportResult>;
export declare const getPublicPassport: (userId: string) => Promise<PublicPassportResult>;
export declare const vouchForUser: (sourceUserId: string, targetUserId: string) => Promise<VouchResult>;
export declare const recordWhatsAppChannelSignal: (userId: string, payload: {
    signalCategory: string;
    scoreDelta?: number;
    meta?: unknown;
}) => Promise<WhatsAppChannelSignalResult>;
export declare const recordSocialGraphSignal: (userId: string, payload: {
    signalCategory: string;
    sourceUserId?: string;
    scoreDelta?: number;
    meta?: unknown;
}) => Promise<SocialGraphSignalResult>;
export declare const recordWeb3Stake: (userId: string, payload: {
    stakeAmount: number;
    meta?: unknown;
}) => Promise<Web3StakeRecordResult>;
export declare const exportPassport: (userId: string) => Promise<PassportExportResult>;
export interface DynamicEscrowInput {
    userId: string;
    category: 'hospitality' | 'live_selling' | 'freelance' | 'gig' | 'general';
    transactionValue: number;
    currency?: string;
}
export interface DynamicEscrowResult {
    suggestedEscrowPercentage: number;
    trustFrictionScore: number;
    reasoning: string;
}
export declare function calculateDynamicEscrow(input: DynamicEscrowInput): Promise<DynamicEscrowResult>;
//# sourceMappingURL=passport-risk.service.d.ts.map