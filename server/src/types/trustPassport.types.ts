/**
 * Trust Passport ZK-proof reputation types.
 *
 * Provides the data structures for issuing and verifying selective disclosure
 * reputation predicates (e.g., trust score thresholds, dispute rate ceilings)
 * without revealing exact raw scores or private transaction histories.
 */

export interface TrustPassportPredicates {
  trustScore: string; // e.g., ">800", ">=750"
  disputeRate: string; // e.g., "<2%", "<=1%"
  [key: string]: string;
}

export interface TrustPassportPayload {
  issuer: "Pabandi";
  subjectId: string; // The business/user ID
  issuedAt: number; // Unix timestamp in ms or seconds
  predicates: {
    trustScore: string; // e.g., ">800"
    disputeRate: string; // e.g., "<2%"
  };
  signature: string; // Mocked BBS+/ZK signature (e.g., "zkp_abc123...")
}

export interface GenerateProofRequest {
  subjectId?: string; // Optional if authenticated (defaults to caller's business/user ID)
  predicates?: Partial<TrustPassportPredicates>;
}

export interface VerifyProofRequest {
  proof: TrustPassportPayload;
  requiredPredicates?: Partial<TrustPassportPredicates>;
}

export interface VerifyProofResult {
  valid: boolean;
  issuer: string;
  subjectId: string;
  issuedAt: number;
  satisfiedPredicates: Record<string, boolean>;
  reason?: string;
}

