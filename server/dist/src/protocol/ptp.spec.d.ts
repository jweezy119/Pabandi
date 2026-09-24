/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PABANDI TRUST PROTOCOL (PTP) — Version 1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * The open protocol specification for portable, verifiable trust in commerce.
 *
 * PTP makes trust scores PORTABLE — a merchant verified on Pabandi carries that
 * trust to any platform that implements PTP, without re-verification.
 *
 * Design Principles:
 *   1. PORTABLE    — attestations work across platforms without API calls
 *   2. VERIFIABLE  — any party can verify offline using Pabandi's public key
 *   3. PRIVATE     — no PII, no exact scores; only risk bands + guarantees
 *   4. METERED     — every verification is a billable event
 *   5. GUARANTEED  — high-trust bands carry financial guarantees
 *
 * Attestation Lifecycle:
 *   1. Entity (merchant/buyer) earns trust through Pabandi's intelligence layers
 *   2. Pabandi issues a PTP Attestation (signed document)
 *   3. Entity presents attestation to any third party
 *   4. Third party verifies offline (public key) or online (API call)
 *   5. If Band A/B: transaction is financially guaranteed by Pabandi
 *
 * Comparable Standards:
 *   - FICO → credit scoring (PTP = trust scoring)
 *   - SSL/TLS → connection security (PTP = transaction trust)
 *   - PCI DSS → payment security (PTP = counterparty reliability)
 * ═══════════════════════════════════════════════════════════════════════════════
 */
export declare const PTP_VERSION = "1.0";
export declare const PTP_PROTOCOL_NAME = "Pabandi Trust Protocol";
export declare const PTP_ATTESTATION_TTL_MS: number;
export declare const PTP_MAX_GUARANTEE_USD = 500;
export type PTPRiskBand = 'A' | 'B' | 'C' | 'D' | 'E';
export declare const PTP_RISK_BANDS: Record<PTPRiskBand, {
    label: string;
    description: string;
    fraudProbability: number;
    noShowProbability: number;
    depositReduction: number;
    guaranteeMaxUSD: number;
    guaranteeFeePercent: number;
    sealColor: string;
}>;
export interface PTPAttestation {
    protocol: string;
    version: string;
    subject: {
        id: string;
        type: 'INDIVIDUAL' | 'BUSINESS' | 'AGENT';
    };
    assessment: {
        riskBand: PTPRiskBand;
        guarantees: {
            fraudProbability: number;
            noShowProbability: number;
            depositReduction: number;
        };
        velocity: {
            direction: string;
            momentum: number;
            confidence: number;
        };
    };
    zkProof?: {
        commitment: string;
        threshold: number;
        verified: boolean;
    };
    guarantee?: {
        maxAmountUSD: number;
        feePercent: number;
        coverageType: string;
        claimEndpoint: string;
    };
    issuedAt: number;
    expiresAt: number;
    nonce: string;
    issuer: string;
    publicKeyId: string;
    signature: string;
}
export interface PTPAgentAttestation {
    protocol: string;
    version: string;
    subject: {
        id: string;
        type: 'AGENT';
    };
    ownerUserId: string;
    capabilities: string[];
    assessment: {
        riskBand: PTPRiskBand;
        guarantees: {
            fraudProbability: number;
            noShowProbability: number;
            depositReduction: number;
        };
        velocity: {
            direction: string;
            momentum: number;
            confidence: number;
        };
    };
    guarantee?: {
        maxAmountUSD: number;
        feePercent: number;
        coverageType: string;
        claimEndpoint: string;
    };
    issuedAt: number;
    expiresAt: number;
    nonce: string;
    issuer: string;
    publicKeyId: string;
    signature: string;
}
export interface PTPVerificationResult {
    valid: boolean;
    expired: boolean;
    signatureValid: boolean;
    attestation?: PTPAttestation;
    verifiedAt: number;
    error?: string;
}
export interface PTPDiscoveryDocument {
    protocol: string;
    version: string;
    issuer: string;
    verification_endpoint: string;
    attestation_endpoint: string;
    seal_endpoint: string;
    guarantee_claim_endpoint: string;
    billing_endpoint: string;
    public_key_endpoint: string;
    public_key: string;
    supported_risk_bands: string[];
    supported_entity_types: string[];
    documentation_url: string;
    contact: string;
}
/**
 * The PTP Engine issues and verifies portable trust attestations.
 */
export declare class PTPEngine {
    /**
     * Issue a PTP Attestation for an individual or business.
     */
    issueAttestation(entityId: string, entityType: 'INDIVIDUAL' | 'BUSINESS', trustScore: number, velocity: {
        direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE';
        momentum: number;
        confidence: number;
    }, zkCommitment?: string, zkThreshold?: number): PTPAttestation;
    /**
     * Verify a PTP Attestation. Can be performed OFFLINE using Pabandi's public key.
     */
    verifyAttestation(attestation: PTPAttestation): PTPVerificationResult;
    /**
     * Generate the PTP Discovery Document for `/.well-known/ptp.json`.
     */
    getDiscoveryDocument(baseUrl: string): PTPDiscoveryDocument;
    issueBatch(entities: Array<{
        entityId: string;
        entityType: 'INDIVIDUAL' | 'BUSINESS';
        trustScore: number;
        velocity: {
            direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE';
            momentum: number;
            confidence: number;
        };
    }>): PTPAttestation[];
    /**
     * Issue a PTP attestation to an AI AGENT carrying scoped, signed `capabilities`
     * (e.g. "act:book", "act:transfer:under:100USD", "scope:user:123"). Any third
     * party can verify, OFFLINE and WITHOUT calling Pabandi, that the agent is
     * permitted to perform a given action. This is the primitive that makes
     * "present your Pabandi Passport" the standard pre-action check for agents.
     */
    issueAgentPassport(input: {
        agentId: string;
        ownerUserId: string;
        capabilities: string[];
        trustScore: number;
        velocity: {
            direction: 'RISING' | 'STEADY' | 'DECLINING' | 'VOLATILE';
            momentum: number;
            confidence: number;
        };
    }): PTPAgentAttestation;
    /**
     * Verify an Agent Capability Passport. Self-contained. If `requireCapability` is
     * given, also confirms that capability is granted (prefix match: "act:transfer"
     * satisfies "act:transfer:under:100USD").
     */
    verifyAgentPassport(att: PTPAgentAttestation, requireCapability?: string): any;
    scoreToRiskBand(score: number): PTPRiskBand;
    private riskBandToMinScore;
    private signAttestation;
    private signAgentAttestation;
    getPublicKeyPEM(): string;
}
export declare const ptpEngine: PTPEngine;
//# sourceMappingURL=ptp.spec.d.ts.map