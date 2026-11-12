export type PassportCategory =
  | 'hospitality'
  | 'live_selling'
  | 'freelance'
  | 'gig'
  | 'general';

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
  axes: { category: PassportCategory; compositeScore: number; tier: string }[];
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

export interface TrustPassportPredicates {
  trustScore: string; // e.g., ">800"
  disputeRate: string; // e.g., "<2%"
  [key: string]: string;
}

export interface TrustPassportPayload {
  issuer: "Pabandi";
  subjectId: string; // The business/user ID
  issuedAt: number; // Timestamp
  predicates: {
    trustScore: string; // e.g., ">800"
    disputeRate: string; // e.g., "<2%"
  };
  signature: string; // Mocked ZK signature (e.g., "zkp_abc123...")
}

export interface VerifyProofResult {
  valid: boolean;
  issuer: string;
  subjectId: string;
  issuedAt: number;
  satisfiedPredicates: Record<string, boolean>;
  reason?: string;
}

